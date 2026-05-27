import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from '@core/services/chat.service';
import { AuthService } from '@core/services/auth.service';
import { ChatMessage, SendMessageRequest } from '@core/models/chat.model';
import { Subscription } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, DatePipe, BackOnEscapeDirective],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.scss']
})
export class ChatWindow implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  @ViewChild('scrollMe') private readonly scrollContainer!: ElementRef;

  roomId = '';
  roomName = '';
  memberCount = 0;
  messages: ChatMessage[] = [];
  newMessage = '';
  myMembershipId = '';
  typingUsers: string[] = [];

  private typingTimeout: any;
  private isTypingSignalSent = false; // Флаг, чтобы не спамить бэкенд при вводе текста
  private wsSubscription?: Subscription;
  private routeSubscription?: Subscription;

  ngOnInit(): void {
    this.myMembershipId = this.auth.currentMembership()?.id || '';
    this.chatService.connect();

    this.wsSubscription = this.chatService.messages$.subscribe(res => {
      this.handleWebSocketResponse(res);
    });

    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const newRoomId = params.get('roomId') ?? params.get('id');
      if (!newRoomId) {
        this.roomId = '';
        this.messages = [];
        return;
      }

      if (this.roomId !== newRoomId) {
        this.roomId = newRoomId;
        this.messages = [];
        this.typingUsers = [];
        this.loadRoomInfo();
        this.loadMessages();
      }
    });

    // Обработка возвращения пользователя на вкладку (чтобы дочитать сообщения)
    window.addEventListener('focus', this.onWindowFocus);
  }

  ngOnDestroy(): void {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.wsSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    window.removeEventListener('focus', this.onWindowFocus);
    this.chatService.disconnect();
  }

  private onWindowFocus = (): void => {
    this.markMessagesSeen();
  };

  loadRoomInfo(): void {
    this.chatService.getRoomById(this.roomId).subscribe(room => {
      this.roomName = room.name || (room.type === 'DIRECT' ? 'Direct' : 'Group');
      this.memberCount = room.memberCount;
    });
  }

  loadMessages(): void {
    if (!this.roomId) return;
    this.chatService.getMessages(this.roomId).subscribe(msgs => {
      // Если бэк отдает новые сверху — раскомментируй .reverse(), но убирай дубликат строки!
      this.messages = msgs;

      this.markMessagesSeen();
      this.scrollToBottom();
    });
  }

  sendMessage(event?: Event): void {
    if (event) {
      event.preventDefault();
      if (event instanceof KeyboardEvent && event.shiftKey) return;
    }
    const text = this.newMessage.trim();
    if (!text) return;

    const req: SendMessageRequest = { roomId: this.roomId, content: text, encrypted: false };
    try {
      this.chatService.sendMessage({ type: 'send_message', message: req });
      this.newMessage = '';

      // Сразу после отправки гасим статус «печатает», не дожидаясь таймера
      if (this.isTypingSignalSent) {
        this.chatService.sendMessage({ type: 'typing', roomId: this.roomId, isTyping: false });
        this.isTypingSignalSent = false;
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }

  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.chatService.uploadMedia(this.roomId, input.files[0]).subscribe();
    input.value = '';
  }

  getFileName(url: string): string {
    return url.split('/').pop() || 'file';
  }

  openMedia(url: string): void {
    if (url) window.open(url, '_blank');
  }

  getInterlocutorName(): string {
    const otherMessage = this.messages.find(m => m.senderMembershipId !== this.myMembershipId);
    return otherMessage ? otherMessage.senderName : (this.roomName !== 'Direct' ? this.roomName : 'Собеседник');
  }

  getTypingText(): string {
    if (!this.typingUsers.length) return '';
    if (this.memberCount === 2) return `${this.getInterlocutorName()} печатает`;

    const names = this.typingUsers.map(id => {
      const foundMessage = this.messages.find(m => m.senderMembershipId === id);
      return foundMessage ? foundMessage.senderName : 'Кто-то';
    });
    const uniqueNames = Array.from(new Set(names));
    return uniqueNames.join(', ') + (uniqueNames.length > 1 ? ' печатают' : ' печатает');
  }

  private handleWebSocketResponse(res: any): void {
    switch (res.type) {
      case 'new_message':
        if (res.message.roomId === this.roomId) {
          this.messages = [...this.messages, res.message];

          if (document.hasFocus()) {
            this.markMessagesSeen();
          }
          this.scrollToBottom();
        }
        break;
      case 'typing_indicator':
        if (res.roomId === this.roomId && res.membershipId !== this.myMembershipId) {
          if (res.isTyping) {
            if (!this.typingUsers.includes(res.membershipId)) {
              this.typingUsers = [...this.typingUsers, res.membershipId];
            }
          } else {
            this.typingUsers = this.typingUsers.filter(id => id !== res.membershipId);
          }
        }
        break;
    }
  }

  onTyping(): void {
    // Отправляем сигнал на бэк только один раз при старте ввода, а не на каждую клавишу
    if (!this.isTypingSignalSent) {
      this.chatService.sendMessage({ type: 'typing', roomId: this.roomId, isTyping: true });
      this.isTypingSignalSent = true;
    }

    if (this.typingTimeout) clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(() => {
      this.chatService.sendMessage({ type: 'typing', roomId: this.roomId, isTyping: false });
      this.isTypingSignalSent = false;
    }, 1500); // 1.5 секунды тишины — значит пользователь закончил вводить текст
  }

  private markMessagesSeen(): void {
    if (!this.messages.length) return;

    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage && lastMessage.senderMembershipId !== this.myMembershipId) {
      this.chatService.sendMessage({ type: 'mark_seen', messageId: lastMessage.id });
    }
  }

  private scrollToBottom(): void {
    // Используем setTimeout, чтобы Angular успел отрендерить новые элементы в DOM
    setTimeout(() => {
      try {
        if (this.scrollContainer?.nativeElement) {
          this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
        }
      } catch (err) {
        console.warn('Scroll failed:', err);
      }
    }, 50);
  }

  goBack(): void {
    this.router.navigate(['/chat']);
  }
}
