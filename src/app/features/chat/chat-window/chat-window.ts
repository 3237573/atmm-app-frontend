// chat-window.component.ts
import {
  Component,
  inject,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  DestroyRef,
  signal,
  computed
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatService } from '@core/services/chat.service';
import { AuthService } from '@core/services/auth.service';
import { ChatMessage, ChatRoom, WebSocketResponse } from '@core/models/chat.model';
import { switchMap, filter, map, tap, of, catchError } from 'rxjs';
import { DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, BackOnEscapeDirective],
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

  readonly roomId = signal<string>('');
  readonly messages = signal<ChatMessage[]>([]);
  readonly typingUsers = signal<string[]>([]);

  newMessage = '';
  myMemberId = '';

  private typingTimeout: any;
  private isTypingSignalSent = false;

  private readonly rooms = toSignal(this.chatService.rooms$, { initialValue: [] });

  readonly currentRoom = computed(() => {
    const id = this.roomId();
    return this.rooms().find((r: ChatRoom) => r.id === id);
  });

  readonly roomName = computed(() => {
    const room = this.currentRoom();
    if (!room) return 'Загрузка...';
    return room.name || room.lastMessage?.senderName || 'Приватный чат';
  });

  readonly memberCount = computed(() => this.currentRoom()?.memberCount || 0);

  ngOnInit(): void {
    this.myMemberId = this.auth.currentUser()?.id || '';

    this.route.params.pipe(
      map(params => params['roomId'] as string),
      filter(Boolean),
      tap(id => {
        this.roomId.set(id);
        this.clearRoomState();

        this.chatService.sendMessage({
          type: 'read_room',
          roomId: id,
          untilTimestamp: new Date().toISOString()
        });
      }),
      switchMap(id => this.chatService.getMessages(id).pipe(
        catchError(err => {
          console.error('❌ Ошибка HTTP при загрузке сообщений:', err);
          return of([]);
        })
      )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(historyMessages => {
      this.messages.set(historyMessages);
      this.scrollToBottomOnNextTick();
      this.markMessagesSeen();
    });

    this.chatService.messages$.pipe(
      filter((res): res is WebSocketResponse & { type: 'new_message' } => res?.type === 'new_message'),
      filter(res => res.message?.roomId === this.roomId()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.messages.update(prev => [...prev, response.message]);
      this.scrollToBottomOnNextTick();
      this.markMessagesSeen();
    });

    this.chatService.typingUsers$.pipe(
      map(typingMap => typingMap[this.roomId()] || []),
      map(usersInRoom => usersInRoom.filter(id => id !== this.myMemberId)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(activeTypingIds => {
      this.typingUsers.set(activeTypingIds);
    });
  }

  isOwnMessage(msg: ChatMessage): boolean {
    return msg?.senderMemberId === this.myMemberId;
  }

  private clearRoomState(): void {
    this.messages.set([]);
    this.typingUsers.set([]);
  }

  sendMessage(event?: KeyboardEvent | Event): void {
    if (event) {
      event.preventDefault();
    }

    const trimmedMessage = this.newMessage.trim();
    if (!trimmedMessage) return;

    this.chatService.sendMessage({
      type: 'send_message',
      message: {
        roomId: this.roomId(),
        content: trimmedMessage
      }
    });

    this.newMessage = '';
    this.scrollToBottomOnNextTick();

    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.chatService.sendMessage({ type: 'typing', roomId: this.roomId(), isTyping: false });
    this.isTypingSignalSent = false;
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

    if (this.typingTimeout) clearTimeout(this.typingTimeout);

    this.typingTimeout = setTimeout(() => {
      this.chatService.sendMessage({ type: 'typing', roomId: this.roomId(), isTyping: false });
      this.isTypingSignalSent = false;
    }, 1500);
  }

  private markMessagesSeen(): void {
    const currentMessages = this.messages();
    if (!currentMessages.length) return;

    const lastMessage = currentMessages[currentMessages.length - 1];
    if (lastMessage && lastMessage.senderMemberId !== this.myMemberId) {
      this.chatService.sendMessage({
        type: 'mark_seen',
        messageId: lastMessage.id
      });
    }
  }

  private scrollToBottomOnNextTick(): void {
    setTimeout(() => this.scrollToBottom(), 50);
  }

  scrollToBottom(): void {
    try {
      const container = this.scrollContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {}
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
    if (!url) return 'Файл';
    return url.split('/').pop() || 'Файл';
  }

  ngOnDestroy(): void {
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }
}
