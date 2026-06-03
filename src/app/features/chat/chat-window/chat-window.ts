// chat-window.component.ts
import { Component, DestroyRef, ElementRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from '@core/services/chat.service';
import { AuthService } from '@core/services/auth.service';
import { ChatMessage, ChatRoomRO, WebSocketResponse } from '@core/models/chat.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';
import { filter } from 'rxjs';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, BackOnEscapeDirective],
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

  // Простые сигналы для данных
  readonly roomId = signal<string>('');
  readonly currentRoom = signal<ChatRoomRO | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly typingUsers = signal<string[]>([]);

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
        this.loadChatData(id); // Вызываем простой метод загрузки
      }
    });

    // 2. WebSocket: новые сообщения (тут filter оставим, чтобы не ловить чужие сообщения)
    this.chatService.messages$.pipe(
      filter((res): res is WebSocketResponse & { type: 'new_message' } =>
        !!res && res.type === 'new_message' && res.message?.roomId === this.roomId()
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.messages.update(prev => [...prev, response.message]);
      this.scrollToBottomOnNextTick();
      this.scheduleMarkSeen();
    });

    // 3. WebSocket: кто печатает
    this.chatService.typingUsers$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(typingMap => {
      const ids = typingMap[this.roomId()] || [];
      // Исключаем себя
      this.typingUsers.set(ids.filter(id => id !== this.myMemberId));
    });
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

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      roomId: this.roomId(),
      content: trimmedMessage,
      senderMemberId: this.myMemberId,
      timestamp: new Date().toISOString(),
      encrypted: false,
      senderName: this.auth.currentUser()?.displayName || '',
      type: 'TEXT'
    };

    this.messages.update(prev => [...prev, optimistic]);
    this.scrollToBottomOnNextTick();

    this.chatService.sendMessage({
      type: 'send_message',
      message: { roomId: this.roomId(), content: trimmedMessage }
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
      this.chatService.sendMessage({ type: 'mark_seen', messageId: lastMessage.id });
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
    } catch (err) {}
  }

  trackByMessageId(index: number, item: ChatMessage) { return item.id; }
  isOwnMessage(msg: ChatMessage): boolean { return msg?.senderMemberId === this.myMemberId; }
  goBack(): void { this.router.navigate(['/chat']); }
  getTypingText(): string { return 'Печатает...'; }

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

  openMedia(url: string): void { window.open(url, '_blank', 'noopener,noreferrer'); }
  getFileName(url: string): string { return url ? url.split('/').pop() || 'Файл' : 'Файл'; }

  ngOnDestroy(): void {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.markSeenTimer) clearTimeout(this.markSeenTimer);
  }
}
