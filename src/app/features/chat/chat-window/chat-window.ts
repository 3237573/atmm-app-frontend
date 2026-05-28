// chat-window.component.ts
import { Component, inject, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewChecked, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from '@core/services/chat.service';
import { AuthService } from '@core/services/auth.service';
import { ChatMessage, ChatRoom, WebSocketResponse } from '@core/models/chat.model';
import {switchMap, filter, map, tap, of} from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';
import {catchError} from 'rxjs/operators';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, DatePipe, BackOnEscapeDirective],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.scss']
})
export class ChatWindow implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatService = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('scrollMe') private readonly scrollContainer!: ElementRef;

  roomId = '';
  roomName = 'Загрузка...';
  memberCount = 0;
  messages: ChatMessage[] = [];
  newMessage = '';
  typingUsers: string[] = [];
  myMemberId = '';

  private typingTimeout: any;
  private isTypingSignalSent = false;
  private shouldScrollToBottom = false;

  ngOnInit(): void {
    this.myMemberId = this.auth.currentUser()?.id || '';

    // Декларативная цепочка изменения URL -> запрос по HTTP -> сокет
    this.route.params.pipe(
      map(params => params['roomId'] as string),
      filter(Boolean),
      tap(id => {
        this.roomId = id;
        this.clearRoomState();

        this.chatService.sendMessage({
          type: 'read_room',
          roomId: id,
          untilTimestamp: new Date().toISOString()
        });

        this.syncRoomMetadata();
      }),
      // 👇 ИЗМЕНЕНИЯ ЗДЕСЬ: Оборачиваем getMessages в pipe и ловим ошибку
      switchMap(id => this.chatService.getMessages(id).pipe(
        catchError(err => {
          console.error('❌ Ошибка HTTP при загрузке сообщений:', err);
          // Возвращаем пустой массив, чтобы поток роутера остался ЖИВ
          return of([]);
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (historyMessages) => {
        this.messages = historyMessages;
        this.shouldScrollToBottom = true;
        this.markMessagesSeen();
      }
      // error: () => ... отсюда обработчик ошибки можно убрать, он больше не сработает
    });

    // Реактивное обновление метаданных при обновлении комнат
    this.chatService.rooms$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      this.syncRoomMetadata();
    });

    // Получение живых сообщений из сокета
    this.chatService.messages$.pipe(
      filter((res): res is WebSocketResponse & { type: 'new_message' } => res?.type === 'new_message'),
      filter(res => res.message?.roomId === this.roomId),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.messages = [...this.messages, response.message];
      this.shouldScrollToBottom = true;
      this.markMessagesSeen();
    });

    // Подписка на индикатор набора текста для текущей комнаты
    this.chatService.typingUsers$.pipe(
      map(typingMap => typingMap[this.roomId] || []),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(usersInRoom => {
      this.typingUsers = usersInRoom.filter(id => id !== this.myMemberId);
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  isOwnMessage(msg: ChatMessage): boolean {
    return msg?.senderMemberId === this.myMemberId;
  }

  private clearRoomState(): void {
    this.messages = [];
    this.roomName = 'Загрузка...';
    this.memberCount = 0;
    this.typingUsers = [];
  }

  private syncRoomMetadata(): void {
    const rooms = (this.chatService.rooms$ as any).value || [];
    const currentRoom = rooms.find((r: ChatRoom) => r.id === this.roomId);
    if (currentRoom) {
      this.memberCount = currentRoom.memberCount;
      this.roomName = currentRoom.name || currentRoom.lastMessage?.senderName || 'Приватный чат';
    }
  }

  sendMessage(event?: Event): void {
    if (event) event.preventDefault();
    if (!this.newMessage.trim()) return;

    this.chatService.sendMessage({
      type: 'send_message',
      message: {
        roomId: this.roomId,
        content: this.newMessage.trim()
      }
    });

    this.newMessage = '';
    this.shouldScrollToBottom = true;

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.chatService.sendMessage({ type: 'typing', roomId: this.roomId, isTyping: false });
    this.isTypingSignalSent = false;
  }

  onTyping(): void {
    if (!this.isTypingSignalSent) {
      this.chatService.sendMessage({ type: 'typing', roomId: this.roomId, isTyping: true });
      this.isTypingSignalSent = true;
    }

    if (this.typingTimeout) clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(() => {
      this.chatService.sendMessage({ type: 'typing', roomId: this.roomId, isTyping: false });
      this.isTypingSignalSent = false;
    }, 1500);
  }

  private markMessagesSeen(): void {
    if (!this.messages.length || !this.roomId) return;
    const lastMessage = this.messages[this.messages.length - 1];

    // Соответствует схеме бэкенда (передается только messageId)
    if (lastMessage && lastMessage.senderMemberId !== this.myMemberId) {
      this.chatService.sendMessage({
        type: 'mark_seen',
        messageId: lastMessage.id
      });
    }
  }

  scrollToBottom(): void {
    try {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  goBack(): void {
    this.router.navigate(['/chat']);
  }

  getTypingText(): string {
    return 'Печатает...';
  }

  getInterlocutorName(): string {
    return this.roomName;
  }

  uploadFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.chatService.uploadMedia(this.roomId, input.files[0]).subscribe({
        next: (msg) => {
          this.messages = [...this.messages, msg];
          this.shouldScrollToBottom = true;
        },
        error: (err) => console.error('Ошибка загрузки файла:', err)
      });
    }
  }

  openMedia(url: string): void {
    window.open(url, '_blank');
  }

  getFileName(url: string): string {
    if (!url) return 'Файл';
    return url.split('/').pop() || 'Файл';
  }

  ngOnDestroy(): void {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }
}
