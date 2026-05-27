// core/services/chat.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { AuthService } from './auth.service';
import { ChatMessage, ChatRoom, CreateChatRoomRequest, WebSocketMessage, WebSocketResponse } from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = '/v1/chat';
  private socket$: WebSocketSubject<any> | null = null;
  private readonly messageSubject = new Subject<WebSocketResponse>();
  private readonly connectionStatus = new BehaviorSubject<boolean>(false);
  private pendingMessages: WebSocketMessage[] = [];
  private connecting = false;

  public messages$ = this.messageSubject.asObservable();
  public isConnected$ = this.connectionStatus.asObservable();

  connect(): void {
    if (this.connectionStatus.value) return;
    if (this.connecting) return;

    this.connecting = true;

    const getCookie = (name: string): string => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
      return '';
    };

    const token = getCookie('auth_token');

    // Если токен удалось прочитать из куки — передаем его,
    // если нет (кука HttpOnly) — строим URL без параметра, браузер прикрепит куку сам
    const wsUrl = token
      ? `ws://${window.location.host}/v1/chat/ws?token=${token}`
      : `ws://${window.location.host}/v1/chat/ws`;

    console.log('Connecting to WebSocket via proxy:', wsUrl);

    if (this.socket$) {
      this.socket$.complete();
      this.socket$ = null;
    }

    this.socket$ = webSocket({
      url: wsUrl,
      deserializer: e => JSON.parse(e.data),
      serializer: v => JSON.stringify(v),
      // Важно: withCredentials в WebSocket не существует.
      // Cookie будут переданы, потому что запрос на тот же origin (4200),
      // а прокси перенаправляет на бэкенд, но cookie для 9083 не отправятся,
      // если они не установлены с Domain=.localhost и Path=/.
      // Поэтому лучший способ – передавать sessionId в URL или в заголовке Sec-WebSocket-Protocol.
      openObserver: {
        next: () => {
          console.log('✅ WebSocket connected');
          this.connectionStatus.next(true);
          this.connecting = false;
          this.flushPendingMessages();
        }
      },
      closeObserver: {
        next: (event) => {
          console.warn('❌ WebSocket disconnected', event);
          this.connectionStatus.next(false);
          this.connecting = false;
          this.socket$ = null;
        }
      }
    });

    this.socket$.subscribe({
      next: (msg: any) => {
        console.log('📨 WebSocket received:', msg);
        this.messageSubject.next(msg as WebSocketResponse);
      },
      error: (err) => {
        console.error('WebSocket error', err);
        this.connectionStatus.next(false);
        this.connecting = false;
        this.socket$ = null;
      },
      complete: () => {
        console.log('WebSocket complete');
        this.connectionStatus.next(false);
        this.connecting = false;
        this.socket$ = null;
      }
    });
  }

  private flushPendingMessages(): void {
    while (this.pendingMessages.length) {
      const msg = this.pendingMessages.shift();
      if (msg) this.sendMessageImmediate(msg);
    }
  }

  disconnect(): void {
    this.socket$?.complete();
    this.connectionStatus.next(false);
    this.pendingMessages = [];
    this.socket$ = null;
    this.connecting = false;
  }

  sendMessage(msg: WebSocketMessage): void {
    if (!this.connectionStatus.value) {
      console.warn('⚠️ WebSocket not ready, queueing message:', msg);
      this.pendingMessages.push(msg);
      if (!this.connecting) this.connect();
      return;
    }
    this.sendMessageImmediate(msg);
  }

  private sendMessageImmediate(msg: WebSocketMessage): void {
    console.log('📤 Sending WebSocket message:', msg);
    this.socket$?.next(msg);
  }

  // REST API (без изменений)
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
