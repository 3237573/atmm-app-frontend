import {Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ActivatedRoute, Router} from '@angular/router';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {filter} from 'rxjs';
import {TranslocoPipe} from '@ngneat/transloco';

import {AuthService} from '@core/services/auth.service';
import {EncryptionService} from '@core/services/chat/encryption.service';
import {ChatService} from '@core/services/chat/chat.service';

import {ChatMessage, ChatRoomRO, WebSocketResponse} from '@core/models/chat.model';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';


@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, BackOnEscapeDirective, TranslocoPipe],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.scss']
})
export class ChatWindow implements OnInit, OnDestroy {
  // ==========================================
  // ЗАВИСИМОСТИ И ССЫЛКИ НА DOM
  // ==========================================
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly encryptionService = inject(EncryptionService); // Внедрение E2EE сервиса
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('scrollMe') private readonly scrollContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('localVideo') private readonly localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') private readonly remoteVideoRef!: ElementRef<HTMLVideoElement>;

  // ==========================================
  // СОСТОЯНИЕ (SIGNALS & FIELDS)
  // ==========================================
  readonly roomId = signal<string>('');
  readonly currentRoom = signal<ChatRoomRO | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly typingUsers = signal<string[]>([]);

  // Состояние звонков WebRTC
  readonly isCallActive = signal<boolean>(false);
  readonly callType = signal<'VIDEO' | 'AUDIO'>('VIDEO');

  newMessage = '';
  myMemberId = '';

  // WebRTC внутренние объекты
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private cachedOfferSdp: string | null = null;
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Таймеры для индикатора печати
  private isTypingSignalSent = false;
  private typingTimer: any;

  // ==========================================
  // ЖИЗНЕННЫЙ ЦИКЛ КОМПОНЕНТА
  // ==========================================
  ngOnInit(): void {
    this.myMemberId = this.auth.currentUser()?.id || '';

    // 1. Подписка на изменение ID комнаты в URL
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params['roomId'];
        if (id) {
          this.roomId.set(id);
          this.chatService.setActiveRoomId(id);
          this.loadChatData(id);

          // Проверка кэша сервиса звонков
          const accepted = (this.chatService as any).acceptedCallData;
          if (accepted && accepted.roomId === id) {
            (this.chatService as any).acceptedCallData = null;
            this.triggerAutoAnswer(accepted.sdp, accepted.callType);
          }
        }
      });

    // 2. Перехват команд ответа на звонок из Сервиса
    this.chatService.acceptCallCommand$.pipe(
      filter(command => command.roomId === this.roomId()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(command => {
      this.triggerAutoAnswer(command.sdp, command.callType);
    });

    // 3. Получение новых сообщений через WebSocket с асинхронной расшифровкой
    this.chatService.messages$.pipe(
      filter((res): res is WebSocketResponse & { type: 'new_message' } =>
        res?.type === 'new_message' && res.message?.roomId === this.roomId()
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(async ({ message }) => {
      // Асинхронно расшифровываем входящее сообщение перед добавлением в поток
      const decryptedMsg = await this.decryptSingleMessage(message);

      this.messages.update(prev => {
        const isDuplicate = prev.some(m => m.id === decryptedMsg.id);
        return isDuplicate ? prev : [...prev, decryptedMsg];
      });
      this.scrollToBottomOnNextTick();
    });

    // 4. Синхронизация печатающих пользователей
    this.chatService.typingUsers$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(typingMap => {
        const ids = typingMap[this.roomId()] || [];
        this.typingUsers.set(ids.filter(id => id !== this.myMemberId));
      });

    // 5. Обработка сигналов WebRTC из сокета
    this.chatService.messages$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(msg => {
        void this.handleCallSignaling(msg);
      });
  }

  ngOnDestroy(): void {
    this.cleanupWebRTC();
    this.chatService.setActiveRoomId(null);
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  // ==========================================
  // ГЕТТЕРЫ (ДЛЯ ШАБЛОНА)
  // ==========================================
  get roomName(): string {
    const room = this.currentRoom();
    if (!room) return 'Загрузка...';
    return room.name || room.lastMessage?.senderName || 'Приватный чат';
  }

  get memberCount(): number {
    return this.currentRoom()?.memberIds.length || 0;
  }

  get targetInterlocutorName(): string {
    const room = this.currentRoom();
    if (!room) return 'Абонент';

    if (room.type === 'DIRECT' || room.memberIds.length === 2) {
      if (room.lastMessage && room.lastMessage.senderMemberId !== this.myMemberId) {
        return room.lastMessage.senderName;
      }
    }
    return room.name || 'Приватный чат';
  }

  // ==========================================
  // ЛОГИКА ТРАНСПОРТА И ОТПРАВКИ СООБЩЕНИЙ
  // ==========================================
  async onSendMessage(event?: Event): Promise<void> {
    event?.preventDefault();
    const trimmed = this.newMessage.trim();
    if (!trimmed) return;

    const roomMembers = this.currentRoom()?.memberIds || [];

    // Безопасный метод отправки с реальным шифрованием контента
    await this.chatService.sendSecureMessage(this.roomId(), trimmed, roomMembers);

    this.newMessage = '';
    this.sendTypingFalseImmediate();
  }

  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.chatService.uploadMedia(this.roomId(), input.files[0])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: async (msg) => {
            const decryptedMsg = await this.decryptSingleMessage(msg);
            this.messages.update(prev => [...prev, decryptedMsg]);
            this.scrollToBottomOnNextTick();
          },
          error: (err) => console.error('Ошибка загрузки файла:', err)
        });
    }
  }

  // ==========================================
  // КРИПТОГРАФИЯ И ДЕШИФРОВАНИЕ (E2EE НАСТОЯЩИЙ МУЛЬТИ-ДЕВАЙС)
  // ==========================================
  private async decryptSingleMessage(message: ChatMessage): Promise<ChatMessage> {
    if (!message.encrypted || !message.metadata) {
      return message;
    }

    try {
      // 1. Получаем device_id именно ЭТОГО устройства из хранилища
      const myDeviceId = await this.encryptionService.getExistingDeviceId();

      // 2. Ищем в метаданных ключ, зашифрованный отправителем конкретно для нашего девайса
      const deviceSpecificKey = `key_d_${myDeviceId}`;

      if (!message.metadata[deviceSpecificKey]) {
        return {
          ...message,
          content: '🔒 [Сообщение зашифровано для других ваших устройств (этого девайса еще не существовало)]'
        };
      }

      // 3. Передаем в сервис шифрования контекст для дешифрации
      const clearText = await this.encryptionService.decryptMessageFromRoom(
        message.content,
        message.metadata,
        myDeviceId
      );

      return { ...message, content: clearText };
    } catch (e) {
      // Детальный лог для отладки структуры данных
      console.error(`[E2EE КРИТИЧЕСКАЯ ОШИБКА] ID: ${message.id}`, {
        contentLength: message.content?.length,
        hasMetadata: !!message.metadata,
        metadata: message.metadata,
        error: e
      });

      return {
        ...message,
        content: '🔒 [Ошибка декодирования: несовпадение ключей сессии или поврежден пакет]'
      };
    }
  }

  // ==========================================
  // ИНДИКАТОР ПЕЧАТИ (TYPING INDICATOR)
  // ==========================================
  onTyping(): void {
    if (!this.isTypingSignalSent) {
      this.chatService.sendMessage({ type: 'typing', roomId: this.roomId(), isTyping: true });
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
      this.chatService.sendMessage({ type: 'typing', roomId: this.roomId(), isTyping: false });
      this.isTypingSignalSent = false;
    }
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      this.typingTimer = null;
    }
  }

  // ==========================================
  // СИГНАЛИНГ И СЕССИИ WEBRTC (ЗВОНКИ)
  // ==========================================
  async initiateCall(type: 'VIDEO' | 'AUDIO'): Promise<void> {
    this.callType.set(type);
    const targetName = this.targetInterlocutorName;

    if (typeof this.chatService.startOutgoingCall === 'function') {
      this.chatService.startOutgoingCall(this.roomId(), type, targetName);
    } else {
      (this.chatService as any).outgoingCall$?.next({
        roomId: this.roomId(),
        callType: type,
        targetName: targetName,
      });
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: type === 'VIDEO',
        audio: true
      });

      this.setupPeerConnection();

      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);

      this.chatService.sendCallOffer(this.roomId(), offer.sdp!, type);
    } catch (err) {
      console.error('Ошибка доступа к медиа-устройствам при звонке:', err);
      (this.chatService as any).outgoingCall$?.next(null);
      this.cleanupWebRTC();
    }
  }

  private triggerAutoAnswer(sdp: string, callType: 'VIDEO' | 'AUDIO'): void {
    this.cachedOfferSdp = sdp;
    this.callType.set(callType);
    this.isCallActive.set(true);

    setTimeout(() => {
      void this.startWebRTCAfterAutoAnswer();
    }, 150);
  }

  private async startWebRTCAfterAutoAnswer(): Promise<void> {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: this.callType() === 'VIDEO',
        audio: true
      });

      this.setupPeerConnection();

      if (this.callType() === 'VIDEO' && this.localVideoRef) {
        this.localVideoRef.nativeElement.srcObject = this.localStream;
      }

      if (this.peerConnection && this.cachedOfferSdp) {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: this.cachedOfferSdp })
        );
        this.processPendingIceCandidates();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.chatService.sendCallAnswer(this.roomId(), answer.sdp!);
      }
    } catch (error) {
      console.error('Ошибка автоответа WebRTC:', error);
      this.chatService.sendCallEnd(this.roomId());
      this.cleanupWebRTC();
    }
  }

  private async handleCallSignaling(msg: any): Promise<void> {
    switch (msg.type) {
      case 'call_answer':
        (this.chatService as any).outgoingCall$?.next(null);
        this.isCallActive.set(true);

        setTimeout(() => {
          if (this.callType() === 'VIDEO' && this.localVideoRef && this.localStream) {
            this.localVideoRef.nativeElement.srcObject = this.localStream;
          }
        }, 50);

        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: msg.sdp })
          );
          this.processPendingIceCandidates();
        }
        break;

      case 'call_ice': {
        const candidate: RTCIceCandidateInit = {
          candidate: msg.candidate.candidate,
          sdpMid: msg.candidate.sdpMid ?? '0',
          sdpMLineIndex: msg.candidate.sdpMLineIndex ?? 0
        };

        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(e => console.error('Ошибка добавления ICE:', e));
        } else {
          this.pendingIceCandidates.push(candidate);
        }
        break;
      }

      case 'call_ended':
        this.cleanupWebRTC();
        break;
    }
  }

  endCall(): void {
    this.chatService.sendCallEnd(this.roomId());
    this.cleanupWebRTC();
  }

  private setupPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.localStream?.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.chatService.sendCallIce(this.roomId(), {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (this.remoteVideoRef && event.streams[0]) {
        this.remoteVideoRef.nativeElement.srcObject = event.streams[0];
      }
    };
  }

  private processPendingIceCandidates(): void {
    if (!this.peerConnection) return;
    for (const candidate of this.pendingIceCandidates) {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(e => console.error('Ошибка добавления ICE кандидата:', e));
    }
    this.pendingIceCandidates = [];
  }

  private cleanupWebRTC(): void {
    this.isCallActive.set(false);
    this.cachedOfferSdp = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.pendingIceCandidates = [];

    (this.chatService as any).outgoingCall$?.next(null);
    (this.chatService as any).incomingCall$?.next(null);
  }

  // ==========================================
  // ВСПОМОГАТЕЛЬНЫЙ ИНТЕРФЕЙСНЫЙ ФУНКЦИОНАЛ
  // ==========================================
  private loadChatData(id: string): void {
    this.clearRoomState();
    this.chatService.getRoomById(id).subscribe({
      next: (room) => this.currentRoom.set(room),
      error: (err) => console.error('Ошибка загрузки комнаты:', err)
    });

    // Загрузка истории чата с параллельной асинхронной расшифровкой
    this.chatService.getMessages(id).subscribe({
      next: async (history) => {
        const decryptedHistory = await Promise.all(
          history.map(msg => this.decryptSingleMessage(msg))
        );
        this.messages.set(decryptedHistory);
        this.scrollToBottomOnNextTick();
      },
      error: (err) => console.error('Ошибка загрузки истории:', err)
    });
  }

  private clearRoomState(): void {
    this.messages.set([]);
    this.typingUsers.set([]);
    this.currentRoom.set(null);
    this.isTypingSignalSent = false;
  }

  private scrollToBottomOnNextTick(): void {
    requestAnimationFrame(() => setTimeout(() => this.scrollToBottom(), 40));
  }

  private scrollToBottom(): void {
    const container = this.scrollContainer?.nativeElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  isOwnMessage(msg: ChatMessage): boolean {
    return msg?.senderMemberId === this.myMemberId;
  }

  goBack(): void {
    void this.router.navigate(['/chat']);
  }

  openMedia(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
