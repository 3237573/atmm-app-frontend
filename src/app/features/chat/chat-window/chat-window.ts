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
  @ViewChild('localVideo') private readonly localVideoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') private readonly remoteVideoRef!: ElementRef<HTMLVideoElement>;

  readonly roomId = signal<string>('');
  readonly currentRoom = signal<ChatRoomRO | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly typingUsers = signal<string[]>([]);

  readonly isCallActive = signal<boolean>(false);
  readonly isIncomingCall = signal<boolean>(false);
  readonly callType = signal<'VIDEO' | 'AUDIO'>('VIDEO');

  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private cachedOfferSdp: string | null = null;
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

  private triggerAutoAnswer(sdp: string, callType: 'VIDEO' | 'AUDIO'): void {
    this.cachedOfferSdp = sdp;
    this.callType.set(callType);
    this.isCallActive.set(true);
    this.isIncomingCall.set(false);

    // Запуск WebRTC после рендеринга шаблона видео
    setTimeout(() => {
      void this.startWebRTCAfterAutoAnswer();
    }, 150);
  }

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

          // 🌟 ПРОВЕРКА КЭША СЕРВИСА (Для переходов из других окон/комнат)
          const accepted = (this.chatService as any).acceptedCallData;
          if (accepted && accepted.roomId === id) {
            // Сразу очищаем кэш, чтобы звонок не триггерился повторно при перезагрузках
            (this.chatService as any).acceptedCallData = null;

            // Запускаем автоответ
            this.triggerAutoAnswer(accepted.sdp, accepted.callType);
          }
        }
      });

    // 2. 🌟 Перехват параметров звонка из Сервиса (Если мы УЖЕ находились в этой комнате)
    this.chatService.acceptCallCommand$.pipe(
      filter(command => command.roomId === this.roomId()), // Реагируем только если ID совпадает
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(command => {
      this.triggerAutoAnswer(command.sdp, command.callType);
    });

    // 3. Новые сообщения через WebSocket
    this.chatService.messages$.pipe(
      filter((res): res is WebSocketResponse & { type: 'new_message' } =>
        res?.type === 'new_message' && res.message?.roomId === this.roomId()
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(({message}) => {
      this.messages.update(prev => {
        const isDuplicate = prev.some(m => m.id === message.id);
        return isDuplicate ? prev : [...prev, message];
      });
      this.scrollToBottomOnNextTick();
    });

    // 4. Индикация печатающих
    this.chatService.typingUsers$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(typingMap => {
        const ids = typingMap[this.roomId()] || [];
        this.typingUsers.set(ids.filter(id => id !== this.myMemberId));
      });

    // 5. Обработка сигналов WebRTC
    this.chatService.messages$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(msg => this.handleCallSignaling(msg));
  }

  private loadChatData(id: string): void {
    this.clearRoomState();
    this.chatService.getRoomById(id).subscribe({
      next: (room) => this.currentRoom.set(room),
      error: (err) => console.error('Ошибка загрузки комнаты:', err)
    });
    this.chatService.getMessages(id).subscribe({
      next: (history) => {
        this.messages.set(history);
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

  get roomName(): string {
    const room = this.currentRoom();
    if (!room) return 'Загрузка...';
    return room.name || room.lastMessage?.senderName || 'Приватный чат';
  }

  get memberCount(): number {
    return this.currentRoom()?.memberIds.length || 0;
  }

  sendMessage(event?: Event): void {
    event?.preventDefault();
    const trimmed = this.newMessage.trim();
    if (!trimmed) return;

    this.chatService.sendMessage({
      type: 'send_message',
      message: {roomId: this.roomId(), content: trimmed}
    });

    this.newMessage = '';
    this.sendTypingFalseImmediate();
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

  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.chatService.uploadMedia(this.roomId(), input.files[0])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
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

  ngOnDestroy(): void {
    this.cleanupWebRTC();
    this.chatService.setActiveRoomId(null);
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }

  // ==================== WEBRTC ====================

  private async handleCallSignaling(msg: any): Promise<void> {
    switch (msg.type) {
      case 'call_offer':
        if (this.isCallActive()) return;
        this.isIncomingCall.set(true);
        this.callType.set(msg.callType);
        this.cachedOfferSdp = msg.sdp;
        break;

      case 'call_answer':
        if (this.peerConnection) {
          await this.peerConnection.setRemoteDescription(
            new RTCSessionDescription({type: 'answer', sdp: msg.sdp})
          );
          this.processPendingIceCandidates();
        }
        break;

      case 'call_ice': {
        const candidate: RTCIceCandidateInit = {
          candidate: msg.candidate,
          sdpMid: '0',
          sdpMLineIndex: 0
        };
        if (this.peerConnection && this.peerConnection.remoteDescription) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
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

  async initiateCall(type: 'VIDEO' | 'AUDIO'): Promise<void> {
    this.callType.set(type);
    this.isCallActive.set(true);

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: type === 'VIDEO',
        audio: true
      });

      this.setupPeerConnection();

      if (type === 'VIDEO' && this.localVideoRef) {
        this.localVideoRef.nativeElement.srcObject = this.localStream;
      }

      const offer = await this.peerConnection!.createOffer();
      await this.peerConnection!.setLocalDescription(offer);
      this.chatService.sendCallOffer(this.roomId(), offer.sdp!, type);
    } catch (err) {
      console.error('Ошибка доступа к медиа:', err);
      this.cleanupWebRTC();
    }
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
          new RTCSessionDescription({type: 'offer', sdp: this.cachedOfferSdp})
        );
        this.processPendingIceCandidates();

        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.chatService.sendCallAnswer(this.roomId(), answer.sdp!);
      }
    } catch (error) {
      console.error('Ошибка автоответа WebRTC:', error);
      // 🛑 НОВОЕ: Сообщаем звонящему, что звонок сорвался!
      this.chatService.sendCallEnd(this.roomId());
      this.cleanupWebRTC();
    }
  }

  async acceptCall(): Promise<void> {
    if (!this.cachedOfferSdp) return;
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

      await this.peerConnection!.setRemoteDescription(
        new RTCSessionDescription({type: 'offer', sdp: this.cachedOfferSdp})
      );
      this.processPendingIceCandidates();

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      this.chatService.sendCallAnswer(this.roomId(), answer.sdp!);
    } catch (err) {
      console.error('Не удалось ответить на звонок:', err);
      this.cleanupWebRTC();
    }
  }

  rejectOrEndCall(): void {
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
        this.chatService.sendCallIce(this.roomId(), event.candidate.candidate);
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
    this.isIncomingCall.set(false);
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
  }
}
