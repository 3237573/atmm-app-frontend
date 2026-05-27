// core/services/chat.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject, interval, Subscription } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { ChatMessage, ChatRoom, CreateChatRoomRequest, WebSocketMessage, WebSocketResponse } from '@core/models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = '/v1/chat';

  private socket$: WebSocketSubject<any> | null = null;
  private pingSubscription: Subscription | null = null;

  private readonly messageSubject = new Subject<WebSocketResponse>();
  private readonly connectionStatus = new BehaviorSubject<boolean>(false);
  private readonly roomsSubject = new BehaviorSubject<ChatRoom[]>([]);
  private readonly typingUsersSubject = new BehaviorSubject<Record<string, string[]>>({});

  private pendingMessages: WebSocketMessage[] = [];
  private connecting = false;

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
          this.startPing();
          this.flushPendingMessages();
          this.loadUserRooms();
        }
      },
      closeObserver: {
        next: (event) => {
          console.warn('❌ WebSocket disconnected', event);
          this.stopPing();
          this.connectionStatus.next(false);
          this.connecting = false;
          this.socket$ = null;
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
        this.stopPing();
        this.connectionStatus.next(false);
        this.connecting = false;
        this.socket$ = null;
      },
      complete: () => {
        this.stopPing();
        this.connectionStatus.next(false);
        this.connecting = false;
        this.socket$ = null;
      }
    });
  }

  public loadUserRooms(): void {
    this.getUserRooms().subscribe(rooms => this.roomsSubject.next(rooms));
  }

  private handleIncomingSocketMessage(res: WebSocketResponse): void {
    if (!res) return;

    switch (res.type) {
      case 'typing_indicator': {
        const currentMap = { ...this.typingUsersSubject.value };
        const roomUsers = currentMap[res.roomId] || [];

        if (res.isTyping) {
          if (!roomUsers.includes(res.membershipId)) {
            currentMap[res.roomId] = [...roomUsers, res.membershipId];
          }
        } else {
          currentMap[res.roomId] = roomUsers.filter(id => id !== res.membershipId);
        }

        this.typingUsersSubject.next(currentMap);
        break;
      }

      case 'new_message':
      case 'room_read':
        this.loadUserRooms();
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

  getUserRooms(): Observable<ChatRoom[]> {
    return this.http.get<ChatRoom[]>(`${this.baseUrl}/rooms`);
  }

  getRoomById(roomId: string): Observable<ChatRoom> {
    return this.http.get<ChatRoom>(`${this.baseUrl}/rooms/${roomId}`);
  }

  createRoom(request: CreateChatRoomRequest): Observable<ChatRoom> {
    return this.http.post<ChatRoom>(`${this.baseUrl}/rooms`, request);
  }

  addMembers(roomId: string, memberIds: string[]): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/rooms/${roomId}/members`, { memberIds });
  }

  removeMember(roomId: string, membershipId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rooms/${roomId}/members/${membershipId}`);
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
}
