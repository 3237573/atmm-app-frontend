// core/services/chat.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, interval, Subscription } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { ChatMessage, ChatRoomRO, CreateChatRoomRequest, WebSocketMessage, WebSocketResponse } from '@core/models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = '/v1/chat';
  private activeRoomId: string | null = null;

  private socket$: WebSocketSubject<any> | null = null;
  private pingSubscription: Subscription | null = null;
  private reconnectTimeout: any = null;

  private readonly messageSubject = new Subject<WebSocketResponse>();
  private readonly connectionStatus = new BehaviorSubject<boolean>(false);
  private readonly roomsSubject = new BehaviorSubject<ChatRoomRO[]>([]);
  private readonly typingUsersSubject = new BehaviorSubject<Record<string, string[]>>({});

  private pendingMessages: WebSocketMessage[] = [];
  private connecting = false;
  private loadingRooms = false;

  public messages$ = this.messageSubject.asObservable();
  public isConnected$ = this.connectionStatus.asObservable();
  public rooms$ = this.roomsSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();

  connect(): void {
    if (this.connectionStatus.value || this.connecting) return;
    this.connecting = true;

    const getCookie = (name: string): string => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
      return '';
    };

    const token = getCookie('auth_token');
    const wsUrl = token
      ? `ws://${window.location.host}/v1/chat/ws?token=${token}`
      : `ws://${window.location.host}/v1/chat/ws`;

    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }

    this.socket$ = webSocket({
      url: wsUrl,
      deserializer: e => JSON.parse(e.data),
      serializer: v => JSON.stringify(v),
      openObserver: {
        next: () => {
          console.log('✅ WebSocket connected');
          this.connectionStatus.next(true);
          this.connecting = false;
          this.clearReconnect();
          this.startPing();
          this.flushPendingMessages();
          this.loadUserRooms(true);
        }
      },
      closeObserver: {
        next: (event) => {
          console.warn('❌ WebSocket disconnected', event);
          this.handleDisconnect();
        }
      }
    });

    this.socket$.subscribe({
      next: (msg: any) => {
        const response = msg as WebSocketResponse;
        this.messageSubject.next(response);
        this.handleIncomingSocketMessage(response);
      },
      error: (err) => {
        console.error('WebSocket error:', err);
        this.handleDisconnect();
      },
      complete: () => {
        this.handleDisconnect();
      }
    });
  }

  // 1. Метод для управления активной комнатой извне
  setActiveRoomId(roomId: string | null): void {
    this.activeRoomId = roomId;

    // Если чат открыли, сразу обнуляем непрочитанные в глобальном стейте
    if (roomId) {
      const updatedRooms = this.roomsSubject.value.map(room =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room
      );
      this.roomsSubject.next(updatedRooms);

      // (Опционально) Здесь же можно дёрнуть метод бэкенда для отправки статуса «прочитано»:
      this.markRoomAsRead(roomId);
    }
  }

  markRoomAsRead(roomId: string): void {
    // 1. Мгновенно зануляем счётчик локально в BehaviorSubject
    const currentRooms = this.roomsSubject.value;
    if (currentRooms.length > 0) {
      const updatedRooms = currentRooms.map(room =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room
      );
      this.roomsSubject.next(updatedRooms);
    }

    // 2. Отправляем событие чтения на бэкенд через WebSocket
    this.socket$?.next({
      type: 'read_room', // Укажите тип события, который вы обрабатываете на бэке (например, в Ktor)
      roomId: roomId
    });
  }

  private handleDisconnect(): void {
    this.stopPing();
    this.connectionStatus.next(false);
    this.connecting = false;
    this.socket$ = null;

    // Автоматический реконнект через 4 секунды
    if (!this.reconnectTimeout) {
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        console.log('🔄 Reconnecting WebSocket...');
        this.connect();
      }, 4000);
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  public loadUserRooms(force = false): void {
    if (!force && this.roomsSubject.value && this.roomsSubject.value.length > 0) {
      return;
    }
    if (this.loadingRooms) return;
    this.loadingRooms = true;
    this.getUserRooms().subscribe({
      next: rooms => {
        this.roomsSubject.next(rooms || []);
        this.loadingRooms = false;
      },
      error: () => {
        this.loadingRooms = false;
      }
    });
  }

  private handleIncomingSocketMessage(res: WebSocketResponse): void {
    if (!res) return;

    switch (res.type) {
      case 'typing_indicator': {
        const currentMap = { ...this.typingUsersSubject.value };
        const roomUsers = currentMap[res.roomId] || [];

        if (res.isTyping) {
          if (!roomUsers.includes(res.memberId)) {
            currentMap[res.roomId] = [...roomUsers, res.memberId];
          }
        } else {
          currentMap[res.roomId] = roomUsers.filter(id => id !== res.memberId);
        }

        this.typingUsersSubject.next(currentMap);
        break;
      }

      case 'new_message': {
        // Реактивно обновляем список комнат локально (без лишних HTTP-запросов)
        const currentRooms = [...this.roomsSubject.value];
        const index = currentRooms.findIndex(r => r.id === res.message.roomId);

        if (index !== -1) {
          const updatedRoom = { ...currentRooms[index] };
          updatedRoom.lastMessage = res.message;

          if (res.message.senderMemberId !== this.auth.currentUser()?.id) {
            updatedRoom.unreadCount += 1;
          }

          // Перемещаем обновленную комнату наверх списка
          currentRooms.splice(index, 1);
          currentRooms.unshift(updatedRoom);
          this.roomsSubject.next(currentRooms);
        } else {
          this.loadUserRooms(true);
        }
        break;
      }

      case 'room_read':
        this.loadUserRooms(true);
        break;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingSubscription = interval(30000).subscribe(() => {
      this.sendMessage({ type: 'ping' });
    });
  }

  private stopPing(): void {
    if (this.pingSubscription) {
      this.pingSubscription.unsubscribe();
      this.pingSubscription = null;
    }
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length) {
      const msg = this.pendingMessages.shift();
      if (msg) this.sendMessageImmediate(msg);
    }
  }

  disconnect(): void {
    this.clearReconnect();
    this.stopPing();
    this.socket$?.complete();
    this.connectionStatus.next(false);
    this.pendingMessages = [];
    this.socket$ = null;
    this.connecting = false;
    this.typingUsersSubject.next({});
  }

  sendMessage(msg: WebSocketMessage): void {
    if (!this.connectionStatus.value) {
      this.pendingMessages.push(msg);
      if (!this.connecting) this.connect();
      return;
    }
    this.sendMessageImmediate(msg);
  }

  private sendMessageImmediate(msg: WebSocketMessage): void {
    this.socket$?.next(msg);
  }

  getUserRooms(): Observable<ChatRoomRO[]> {
    return this.http.get<ChatRoomRO[]>(`${this.baseUrl}/rooms`);
  }

  getRoomById(roomId: string): Observable<ChatRoomRO> {
    return this.http.get<ChatRoomRO>(`${this.baseUrl}/rooms/${roomId}`);
  }

  createRoom(request: CreateChatRoomRequest): Observable<ChatRoomRO> {
    return this.http.post<ChatRoomRO>(`${this.baseUrl}/rooms`, request);
  }

  addMembers(roomId: string, memberIds: string[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rooms/${roomId}/members`, { memberIds });
  }

  removeMember(roomId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rooms/${roomId}/members/${memberId}`);
  }

  getMessages(roomId: string, limit = 50, offset = 0): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/rooms/${roomId}/messages`, {
      params: { limit, offset }
    });
  }

  uploadMedia(roomId: string, file: File): Observable<ChatMessage> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ChatMessage>(`${this.baseUrl}/upload/${roomId}`, formData);
  }

  // ==========================================
  // WEBRTC SIGNALING METHODS
  // ==========================================

  sendCallOffer(roomId: string, sdp: string, callType: 'VIDEO' | 'AUDIO'): void {
    this.socket$?.next({
      type: 'call_offer',
      roomId: roomId,
      sdp: sdp,
      callType: callType
    });
  }

  sendCallAnswer(roomId: string, sdp: string): void {
    this.socket$?.next({
      type: 'call_answer',
      roomId: roomId,
      sdp: sdp
    });
  }

  sendCallIce(roomId: string, candidate: string): void {
    this.socket$?.next({
      type: 'call_ice',
      roomId: roomId,
      candidate: candidate
    });
  }

  sendCallEnd(roomId: string): void {
    this.socket$?.next({
      type: 'call_end',
      roomId: roomId
    });
  }



}
