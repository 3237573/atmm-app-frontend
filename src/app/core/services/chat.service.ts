// core/services/chat.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { ChatMessage, ChatRoomRO, CreateChatRoomRequest, WebSocketMessage, WebSocketResponse } from '@core/models/chat.model';

interface IncomingCall {
  roomId: string;
  callType: 'VIDEO' | 'AUDIO';
  sdp: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = '/v1/chat';
  private activeRoomId: string | null = null;

  private worker: SharedWorker | null = null;
  private normalSocket: WebSocket | null = null; // 🌟 Ссылка на прямой сокет для мобильных платформ

  public readonly acceptCallCommand$ = new Subject<{ roomId: string, sdp: string, callType: 'VIDEO' | 'AUDIO' }>();
  private readonly messageSubject = new Subject<WebSocketResponse>();
  private readonly connectionStatus = new BehaviorSubject<boolean>(false);
  private readonly roomsSubject = new BehaviorSubject<ChatRoomRO[]>([]);
  private readonly typingUsersSubject = new BehaviorSubject<Record<string, string[]>>({});

  private loadingRooms = false;

  // ГЛОБАЛЬНЫЙ СТЕЙТ ЗВОНКА
  public readonly incomingCall$ = new BehaviorSubject<IncomingCall | null>(null);
  public messages$ = this.messageSubject.asObservable();
  public isConnected$ = this.connectionStatus.asObservable();
  public rooms$ = this.roomsSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();

  connect(): void {
    const token = this.getCookie('auth_token');
    const host = window.location.host;
    const protocol = window.location.protocol;

    // 🌟 ИСПРАВЛЕНО: Если SharedWorker не поддерживается, запускаем прямой WebSocket-фоллбэк
    if (typeof SharedWorker === 'undefined') {
      console.warn('⚡ [ChatService] SharedWorker не поддерживается. Запускаем фоллбэк на обычный WebSocket.');
      this.connectNormalWS(token, host, protocol);
      return;
    }

    // КРИТИЧЕСКИЙ ГВАРД: Если воркер для этой вкладки уже создан, не создаем его заново!
    if (this.worker) {
      return;
    }

    this.worker = new SharedWorker('/chat.worker.js', { name: 'ChatWorker' });

    // Автоматически удаляем порт из воркера, если вкладка закрывается или обновляется (F5)
    window.addEventListener('beforeunload', () => {
      if (this.worker) {
        this.worker.port.postMessage({ action: 'UNLOAD_PORT' });
      }
    });

    this.worker.port.onmessage = (event) => {
      const data = event.data;

      if (data.type === 'WS_STATUS') {
        this.connectionStatus.next(data.connected);
      } else if (data.type === 'WS_MESSAGE') {
        const response = data.payload as WebSocketResponse;

        if (response.type === 'call_offer') {
          this.incomingCall$.next({
            roomId: response.roomId,
            callType: response.callType as 'VIDEO' | 'AUDIO',
            sdp: response.sdp
          });
        } else if (response.type === 'call_ended') {
          this.incomingCall$.next(null);
        }

        this.handleIncomingSocketMessage(response);
        this.messageSubject.next(response);
      } else if (data.type === 'HIDE_CALL_MODAL') {
        this.incomingCall$.next(null);
      }
    };

    this.worker.port.start();
    this.worker.port.postMessage({
      action: 'INIT',
      token: token,
      host: host,
      protocol: protocol
    });
  }

  // 🌟 Новый метод автоматического подключения для мобильных платформ
  private connectNormalWS(token: string, host: string, protocol: string): void {
    if (this.normalSocket && (this.normalSocket.readyState === WebSocket.OPEN || this.normalSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = token
      ? `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/v1/chat/ws?token=${token}`
      : `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}/v1/chat/ws`;

    this.normalSocket = new WebSocket(wsUrl);

    this.normalSocket.onopen = () => {
      this.connectionStatus.next(true);
      console.log('🚀 [Mobile WS] Соединение успешно установлено напрямую');
    };

    this.normalSocket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data) as WebSocketResponse;

        if (response.type === 'call_offer') {
          this.incomingCall$.next({
            roomId: response.roomId,
            callType: response.callType as 'VIDEO' | 'AUDIO',
            sdp: response.sdp
          });
        } else if (response.type === 'call_ended') {
          this.incomingCall$.next(null);
        }

        this.handleIncomingSocketMessage(response);
        this.messageSubject.next(response);
      } catch (e) {
        console.error('[Mobile WS Error] Ошибка парсинга сообщения:', e);
      }
    };

    this.normalSocket.onclose = () => {
      this.connectionStatus.next(false);
      console.warn('🔌 [Mobile WS] Соединение закрыто. Реконнект через 4 секунды...');
      // Авто-реконнект для мобилки при разрыве сети
      setTimeout(() => this.connectNormalWS(token, host, protocol), 4000);
    };
  }

  disconnect(): void {
    // 1. Отключаем SharedWorker (для ПК)
    if (this.worker) {
      this.worker.port.postMessage({ action: 'DISCONNECT' });
      this.worker = null;
    }

    // 2. Отключаем прямой сокет (для телефонов)
    if (this.normalSocket) {
      this.normalSocket.close();
      this.normalSocket = null;
    }

    // 3. 🌟 КРИТИЧЕСКИ ВАЖНО: Полностью очищаем глобальный стейт сервиса для UI
    this.activeRoomId = null;               // Сбрасываем активную комнату
    this.connectionStatus.next(false);      // Переводим статус в "offline"
    this.roomsSubject.next([]);             // 🌟 Очищаем список комнат в UI (теперь список пустеет)
    this.typingUsersSubject.next({});       // Очищаем индикаторы печати
    this.incomingCall$.next(null);          // Принудительно закрываем модалку звонка, если она была

    console.log('🔌 [ChatService] Полное отключение выполнено, локальный стейт очищен.');
  }

  sendMessage(msg: WebSocketMessage): void {
    if (this.worker) {
      this.worker.port.postMessage({ action: 'SEND_WS', payload: msg });
    }
    // 🌟 ИСПРАВЛЕНО: Отправка данных на мобильных устройствах напрямую через нативный WebSocket
    else if (this.normalSocket && this.normalSocket.readyState === WebSocket.OPEN) {
      this.normalSocket.send(JSON.stringify(msg));
    } else {
      console.error('❌ [ChatService] Невозможно отправить сообщение: нет активного соединения');
    }
  }

  // Вызывается из компонента, когда пользователь жмет "Ответить"
  notifyCallAnswered(roomId: string): void {
    this.incomingCall$.next(null); // Убираем модалку локально
    if (this.worker) {
      // Говорим воркеру, чтобы он закрыл модалки в других вкладках
      this.worker.port.postMessage({ action: 'CALL_ANSWERED_LOCALLY', payload: { roomId } });
    }
  }

  private getCookie(name: string): string {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  }

  setActiveRoomId(roomId: string | null): void {
    this.activeRoomId = roomId;

    if (roomId) {
      const updatedRooms = this.roomsSubject.value.map(room =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room
      );
      this.roomsSubject.next(updatedRooms);
      this.markRoomAsRead(roomId);
    }
  }

  markRoomAsRead(roomId: string): void {
    // Мгновенно зануляем счётчик локально
    const currentRooms = this.roomsSubject.value;
    if (currentRooms.length > 0) {
      const updatedRooms = currentRooms.map(room =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room
      );
      this.roomsSubject.next(updatedRooms);
    }

    this.sendMessage({
      type: 'read_room',
      roomId: roomId,
      untilTimestamp: new Date().toISOString()
    });
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
        const currentRooms = [...this.roomsSubject.value];
        const index = currentRooms.findIndex(r => r.id === res.message.roomId);

        if (index !== -1) {
          const updatedRoom = { ...currentRooms[index] };
          updatedRoom.lastMessage = res.message;

          if (res.message.senderMemberId !== this.auth.currentUser()?.id && res.message.roomId !== this.activeRoomId) {
            updatedRoom.unreadCount += 1;
          }

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
    // Убедись, что бэкенд (Ktor) ожидает объект с полем memberIds
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
    this.sendMessage({
      type: 'call_offer',
      roomId: roomId,
      sdp: sdp,
      callType: callType
    });
  }

  sendCallAnswer(roomId: string, sdp: string): void {
    this.sendMessage({
      type: 'call_answer',
      roomId: roomId,
      sdp: sdp
    });
  }

  sendCallIce(
    roomId: string,
    candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null }
  ): void {
    this.sendMessage({
      type: 'call_ice',
      roomId: roomId,
      candidate: candidate
    });
  }

  sendCallEnd(roomId: string): void {
    this.sendMessage({
      type: 'call_end',
      roomId: roomId
    });
  }
}
