import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ChatService } from '@core/services/chat.service';
import { AuthService } from '@core/services/auth.service';
import { ChatRoom, ChatMessage } from '@core/models/chat.model';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [FormsModule, DatePipe, BackOnEscapeDirective],
  templateUrl: './chat-list.html',
  styleUrls: ['./chat-list.scss']
})
export class ChatList implements OnInit, OnDestroy {
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  private subscription?: Subscription;

  rooms: ChatRoom[] = [];
  selectedRoomId: string | null = null;
  unreadCount: Record<string, number> = {};
  directChatNames: Record<string, string> = {}; // Хранилище имен собеседников
  myMembershipId = '';

  ngOnInit(): void {
    this.myMembershipId = this.authService.currentMembership()?.id || '';
    this.loadRooms();

    this.subscription = this.chatService.messages$.subscribe(msg => {
      if (msg.type === 'new_message') {
        this.updateRoomLastMessage(msg.message);
        if (this.selectedRoomId !== msg.message.roomId) {
          this.unreadCount[msg.message.roomId] = (this.unreadCount[msg.message.roomId] || 0) + 1;
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  loadRooms(): void {
    this.chatService.getUserRooms().subscribe(rooms => {
      this.rooms = rooms;
      this.initDirectChatNames();
    });
  }

  private initDirectChatNames(): void {
    this.rooms.forEach(room => {
      if (room.type === 'DIRECT') {
        // Если последнее сообщение не от нас — запоминаем имя автора как имя чата
        if (room.lastMessage && room.lastMessage.senderMembershipId !== this.myMembershipId) {
          this.directChatNames[room.id] = room.lastMessage.senderName;
        }
      }
    });
  }

  selectRoom(roomId: string): void {
    this.selectedRoomId = roomId;
    this.unreadCount[roomId] = 0;
    this.router.navigate(['/chat', roomId]);
  }

  openNewChatDialog(): void {
    console.log('Open new chat dialog');
  }

  getDisplayName(room: ChatRoom): string {
    if (room.type === 'DIRECT') {
      // Возвращаем зафиксированное имя собеседника. Иначе фолбек.
      return this.directChatNames[room.id] || (room.name !== 'Direct' ? room.name! : 'Собеседник');
    }
    return room.name || 'Групповой чат';
  }

  getAvatarText(room: ChatRoom): string {
    const name = this.getDisplayName(room);
    return name && name !== 'Собеседник' ? name.trim().charAt(0).toUpperCase() : '?';
  }

  private updateRoomLastMessage(msg: ChatMessage): void {
    const idx = this.rooms.findIndex(r => r.id === msg.roomId);
    if (idx !== -1) {
      this.rooms[idx] = { ...this.rooms[idx], lastMessage: msg };

      // Если собеседник написал в приватный чат — обновляем/фиксируем его имя
      if (this.rooms[idx].type === 'DIRECT' && msg.senderMembershipId !== this.myMembershipId) {
        this.directChatNames[msg.roomId] = msg.senderName;
      }

      this.rooms.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return timeB - timeA;
      });
    } else {
      this.loadRooms();
    }
  }
}
