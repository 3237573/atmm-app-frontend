// chat-list.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChatService } from '@core/services/chat.service';
import { ChatRoom } from '@core/models/chat.model';
import { filter, startWith } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { DestroyRef } from '@angular/core';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './chat-list.html',
  styleUrls: ['./chat-list.scss']
})
export class ChatList implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  rooms: ChatRoom[] = [];
  filteredRooms: ChatRoom[] = [];
  searchQuery = '';
  activeRoomId = '';

  ngOnInit(): void {
    this.chatService.loadUserRooms();
    this.chatService.connect();

    this.chatService.rooms$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(rooms => {
      this.rooms = rooms;
      this.onSearchChange();
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      startWith(null),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      const urlParts = this.router.url.split('/');
      this.activeRoomId = urlParts[2] || '';
    });
  }

  onSearchChange(): void {
    if (!this.searchQuery.trim()) {
      this.filteredRooms = [...this.rooms];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredRooms = this.rooms.filter(room => {
      const roomName = room.name || room.lastMessage?.senderName || 'Чат';
      return roomName.toLowerCase().includes(query);
    });
  }

  selectRoom(roomId: string): void {
    this.router.navigate(['/chat', roomId]);
  }

  getDisplayRoomName(room: ChatRoom): string {
    if (room.name) return room.name;
    if (room.type === 'DIRECT' && room.lastMessage) {
      return room.lastMessage.senderName;
    }
    return 'Приватный чат';
  }
}
