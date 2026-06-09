// chat-list.component.ts
import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {NavigationEnd, Router} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {ChatService} from '@core/services/chat.service';
import {ChatRoomBaseRO} from '@core/models/chat.model';
import {filter, startWith} from 'rxjs';
import {FormsModule} from '@angular/forms';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [FormsModule, BackOnEscapeDirective, TranslocoPipe],
  templateUrl: './chat-list.html',
  styleUrls: ['./chat-list.scss']
})
export class ChatList implements OnInit {
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  rooms: ChatRoomBaseRO[] = [];
  filteredRooms: ChatRoomBaseRO[] = [];
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
    const safeRooms = this.rooms || []; // Защита от null с бэкенда
    if (!this.searchQuery.trim()) {
      this.filteredRooms = [...safeRooms];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredRooms = this.rooms.filter(room => {
      const roomName = room.name || 'Чат';
      return roomName.toLowerCase().includes(query);
    });
  }

  selectRoom(roomId: string): void {
    void this.router.navigate(['/chat', roomId]);
  }

  // Получить первую букву для аватара
  getAvatarInitials(room: ChatRoomBaseRO): string {
    const name = room.name;
    return name ? name.trim().charAt(0).toUpperCase() : '✏️';
  }

// Сгенерировать стабильный цвет на основе строки (например, id комнаты)
  getAvatarColor(roomId: string): string {
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
      '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
      '#8bc34a', '#ff9800', '#ff5722', '#795548'
    ];

    // Хэшируем строку, чтобы для одной и той же комнаты всегда был один цвет
    let hash = 0;
    for (let i = 0; i < roomId.length; i++) {
      hash = roomId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

}
