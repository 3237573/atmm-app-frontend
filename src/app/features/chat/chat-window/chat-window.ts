// chat-window.component.ts
import {Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {ChatService} from '@core/services/chat.service';
import {AuthService} from '@core/services/auth.service';
import {ChatMessage, ChatRoomRO, WebSocketResponse} from '@core/models/chat.model';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {filter} from 'rxjs';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, BackOnEscapeDirective, TranslocoPipe],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.scss']
})
export class ChatWindow implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('scrollMe') private readonly scrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('localVideo') private localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') private remoteVideoRef!: ElementRef<HTMLVideoElement>;

  // Простые сигналы для данных
  readonly roomId = signal<string>('');
  readonly currentRoom = signal<ChatRoomRO | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly typingUsers = signal<string[]>([]);

  // 2. ДОБАВИТЬ: Сигналы управления звонком
  readonly isCallActive = signal<boolean>(false);
  readonly isIncomingCall = signal<boolean>(false);
  readonly callType = signal<'VIDEO' | 'AUDIO'>('VIDEO');

  // 3. ДОБАВИТЬ: Внутренние WebRTC объекты
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      {urls: 'stun:stun.l.google.com:19302'},
      {urls: 'stun:stun1.l.google.com:19302'}
    ]
  };

  newMessage = '';
  myMemberId = '';
  private isTypingSignalSent = false;
  private typingTimer: any;
  private markSeenTimer: any;

  ngOnInit(): void {
    this.myMemberId = this.auth.currentUser()?.id || '';

    // 1. Просто подписываемся на изменение ID в урле
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const id = params['roomId'];
      if (id) {
        this.roomId.set(id);
        this.chatService.setActiveRoomId(id)
        this.loadChatData(id); // Вызываем простой метод загрузки
      }
    });

    // 2. WebSocket: новые сообщения
    this.chatService.messages$.pipe(
      filter((res): res is WebSocketResponse &
        { type: 'new_message' } => this.isCurrentRoomMessage(res)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({message}) => {
      this.messages.update(prev => {
        // 🛑 БРОНЕЖИЛЕТ: Проверяем, нет ли уже такого сообщения в массиве
        const isDuplicate = prev.some(m => m.id === message.id);
        if (isDuplicate) {
          return prev; // Игнорируем дубликат
        }
        return [...prev, message]; // Добавляем только уникальное
      });
      this.scrollToBottomOnNextTick();
    });

    // 3. WebSocket: кто печатает
    this.chatService.typingUsers$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(typingMap => {
      const ids = typingMap[this.roomId()] || [];
      // Исключаем себя
      this.typingUsers.set(ids.filter(id => id !== this.myMemberId));
    });

    // 4. ДОБАВИТЬ: Подписка на входящие сигналы WebRTC из шины сокета
    this.chatService.messages$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response: any) => {
      void this.handleCallSignaling(response);
    });

    // Слушаем изменение Query параметров для авто-ответа на вызов
    this.route.queryParams.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      if (params['autoAnswer'] === 'true' && params['sdp']) {
        const incomingSdp = params['sdp'];

        // Немедленно вычищаем параметры из URL (чтобы при обычном рефреше страницы F5 звонок не запускался повторно)
        void this.router.navigate([], {
          queryParams: {autoAnswer: null, sdp: null},
          queryParamsHandling: 'merge'
        });

        // Запускаем WebRTC подключение на основе переданного SDP
        void this.handleIncomingCallFromOverlay(incomingSdp);
      }
    });
  }

  // Метод обработки звонка, принятого из глобального оверлея
  private async handleIncomingCallFromOverlay(offerSdp: string): Promise<void> {
    this.isIncomingCall.set(false);
    this.isCallActive.set(true);

    try {
      // Захватываем медиа-потоки вкладки
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: this.callType() === 'VIDEO',
        audio: true
      });

      this.setupPeerConnection();

      if (this.callType() === 'VIDEO' && this.localVideoRef) {
        this.localVideoRef.nativeElement.srcObject = this.localStream;
      }

      // Накатываем удаленное описание, пришедшее из оверлея
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription({type: 'offer', sdp: offerSdp}));
      this.processPendingIceCandidates();

      // Создаем ответ (Answer)
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      // Передаем ответ бэкенду
      this.chatService.sendCallAnswer(this.roomId(), answer.sdp!);
    } catch (err) {
      console.error('Не удалось инициализировать WebRTC сессию после оверлея:', err);
      this.cleanupWebRTC();
    }
  }

  // Тот самый простой метод загрузки данных без "пайпов-хуяйпов"
  private loadChatData(id: string): void {
    this.clearRoomState();

    // Получаем данные комнаты по ID
    this.chatService.getRoomById(id).subscribe({
      next: (room) => this.currentRoom.set(room),
      error: (err) => console.error('Ошибка загрузки комнаты:', err)
    });

    // Получаем сообщения для этой комнаты
    this.chatService.getMessages(id).subscribe({
      next: (historyMessages) => {
        this.messages.set(historyMessages);
        this.scrollToBottomOnNextTick();
        this.scheduleMarkSeen();
        this.sendReadRoomSignal();
      },
      error: (err) => console.error('Ошибка загрузки истории сообщений:', err)
    });
  }

  // Геттеры для шаблона стали максимально простыми
  get roomName(): string {
    const room = this.currentRoom();
    if (!room) return 'Загрузка...';
    return room.name || room.lastMessage?.senderName || 'Приватный чат';
  }

  get memberCount(): number {
    return this.currentRoom()?.memberIds.length || 0;
  }

  // --- Ниже остаётся стандартная логика отправки и утилит ---

  private clearRoomState(): void {
    this.messages.set([]);
    this.typingUsers.set([]);
    this.currentRoom.set(null);
    this.isTypingSignalSent = false;
  }

  sendMessage(event?: KeyboardEvent | Event): void {
    if (event) event.preventDefault();
    const trimmedMessage = this.newMessage.trim();
    if (!trimmedMessage) return;

    this.chatService.sendMessage({
      type: 'send_message',
      message: {roomId: this.roomId(), content: trimmedMessage}
    });

    this.newMessage = '';
    this.sendTypingFalseImmediate();
    this.scheduleMarkSeen();
  }

  onKeyPress(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      this.sendMessage(keyboardEvent);
    }
  }

  onTyping(): void {
    if (!this.isTypingSignalSent) {
      this.chatService.sendMessage({type: 'typing', roomId: this.roomId(), isTyping: true});
      this.isTypingSignalSent = true;
    }
    this.resetTypingTimeout();
  }

  private resetTypingTimeout(): void {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => this.sendTypingFalseImmediate(), 1500);
  }

  private sendTypingFalseImmediate(): void {
    if (this.isTypingSignalSent) {
      this.chatService.sendMessage({type: 'typing', roomId: this.roomId(), isTyping: false});
      this.isTypingSignalSent = false;
    }
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  private scheduleMarkSeen(): void {
    if (this.markSeenTimer) clearTimeout(this.markSeenTimer);
    this.markSeenTimer = setTimeout(() => {
      this.markMessagesSeen();
      this.markSeenTimer = null;
    }, 500);
  }

  private markMessagesSeen(): void {
    const currentMessages = this.messages();
    if (!currentMessages.length) return;
    const lastMessage = currentMessages[currentMessages.length - 1];
    if (lastMessage && lastMessage.senderMemberId !== this.myMemberId) {
      this.chatService.sendMessage({type: 'mark_seen', messageId: lastMessage.id});
    }
  }

  private sendReadRoomSignal(): void {
    if (!this.roomId()) return;
    this.chatService.sendMessage({
      type: 'read_room',
      roomId: this.roomId(),
      untilTimestamp: new Date().toISOString()
    });
  }

  private scrollToBottomOnNextTick(): void {
    requestAnimationFrame(() => setTimeout(() => this.scrollToBottom(), 40));
  }

  scrollToBottom(): void {
    try {
      const container = this.scrollContainer?.nativeElement;
      if (container) container.scrollTop = container.scrollHeight;
    } catch (err) {
    }
  }

  trackByMessageId(index: number, item: ChatMessage) {
    return item.id;
  }

  isOwnMessage(msg: ChatMessage): boolean {
    return msg?.senderMemberId === this.myMemberId;
  }

  goBack(): void {
    this.router.navigate(['/chat']);
  }

  getTypingText(): string {
    return 'Печатает...';
  }

  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.chatService.uploadMedia(this.roomId(), input.files[0]).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (msg) => {
          this.messages.update(prev => [...prev, msg]);
          this.scrollToBottomOnNextTick();
        },
        error: (err) => console.error('Ошибка загрузки файла:', err)
      });
    }
  }

  openMedia(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  getFileName(url: string): string {
    return url ? url.split('/').pop() || 'Файл' : 'Файл';
  }

  ngOnDestroy(): void {
    this.cleanupWebRTC();
    this.chatService.setActiveRoomId(null);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.markSeenTimer) clearTimeout(this.markSeenTimer);
  }

  // ==========================================
  // ЛОГИКА СИГНАЛИНГА И РАБОТЫ С WEBRTC
  // ==========================================

  // Маппинг входящих сообщений от Ktor-сервера (классы WebSocketResponse на бэкенде)
  private async handleCallSignaling(msg: any): Promise<void> {
    switch (msg.type) {
      case 'call_offer':
        // Нам звонят. Если мы уже в звонке — игнорируем, если нет — показываем модалку
        if (this.isCallActive()) return;
        this.isIncomingCall.set(true);
        this.callType.set(msg.callType);
        // Сохраняем SDP офер во внутреннее свойство, чтобы применить при нажатии "Ответить"
        (this as any).cachedOfferSdp = msg.sdp;
        break;

      case 'call_answer':
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription({type: 'answer', sdp: msg.sdp}));
          this.processPendingIceCandidates();
        }
        break;

      case 'call_ice':
        const candidateInit: RTCIceCandidateInit = {candidate: msg.candidate, sdpMid: '0', sdpMLineIndex: 0};
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
        } else {
          this.pendingIceCandidates.push(candidateInit);
        }
        break;

      case 'call_ended':
        this.cleanupWebRTC();
        break;
    }
  }

  // Действие 1: Нажали кнопку "Позвонить" (Мы - Инициатор)
  async initiateCall(type: 'VIDEO' | 'AUDIO'): Promise<void> {
    this.callType.set(type);
    this.isCallActive.set(true);

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: type === 'VIDEO',
        audio: true
      });

      this.setupPeerConnection();

      // Показываем локальное превью
      if (type === 'VIDEO' && this.localVideoRef) {
        this.localVideoRef.nativeElement.srcObject = this.localStream;
      }

      // Создаем Offer
      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      // Отправляем офер на бэк
      this.chatService.sendCallOffer(this.roomId(), offer.sdp!, type);
    } catch (err) {
      console.error('Ошибка доступа к медиа-устройствам:', err);
      this.cleanupWebRTC();
    }
  }

  // Действие 2: Нажали кнопку "Ответить" (Мы - Получатель)
  async acceptCall(): Promise<void> {
    const offerSdp = (this as any).cachedOfferSdp;
    this.isIncomingCall.set(false);
    this.isCallActive.set(true);

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: this.callType() === 'VIDEO',
        audio: true
      });

      this.setupPeerConnection();

      if (this.callType() === 'VIDEO' && this.localVideoRef) {
        this.localVideoRef.nativeElement.srcObject = this.localStream;
      }

      // Применяем удаленный Offer от инициатора
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription({type: 'offer', sdp: offerSdp}));
      this.processPendingIceCandidates();

      // Генерируем Answer
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      // Отправляем ответ назад
      this.chatService.sendCallAnswer(this.roomId(), answer.sdp!);
    } catch (err) {
      console.error('Не удалось принять звонок:', err);
      this.cleanupWebRTC();
    }
  }

  // Инициализация объекта соединения WebRTC
  private setupPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Добавляем локальные треки в канал связи
    this.localStream?.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    // Генерация ICE кандидатов и отправка их партнеру через сокет
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.chatService.sendCallIce(this.roomId(), event.candidate.candidate);
      }
    };

    // Ловим входящий видео/аудио поток от собеседника
    this.peerConnection.ontrack = (event) => {
      if (this.remoteVideoRef && event.streams[0]) {
        this.remoteVideoRef.nativeElement.srcObject = event.streams[0];
      }
    };
  }

  // Нажатие кнопки сброса/отклонения
  rejectOrEndCall(): void {
    this.chatService.sendCallEnd(this.roomId());
    this.cleanupWebRTC();
  }

  private processPendingIceCandidates(): void {
    if (!this.peerConnection) return;
    this.pendingIceCandidates.forEach(candidate => {
      this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
    });
    this.pendingIceCandidates = [];
  }

  private isCurrentRoomMessage(res: any): res is WebSocketResponse & { type: 'new_message' } {
    return res?.type === 'new_message' && res.message?.roomId === this.roomId();
  }

  // Сброс состояния, гашение камеры и закрытие портов соединений
  private cleanupWebRTC(): void {
    this.isCallActive.set(false);
    this.isIncomingCall.set(false);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingIceCandidates = [];
    (this as any).cachedOfferSdp = null;
  }
}
