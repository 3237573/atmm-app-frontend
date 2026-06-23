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
  private normalSocket: WebSocket | null = null;
  private mobileReconnectTimer: any = null; // 🌟 ИСПРАВЛЕНО: Храним таймер, чтобы не плодить утечки реконнектов

  public readonly acceptCallCommand$ = new Subject<{ roomId: string, sdp: string, callType: 'VIDEO' | 'AUDIO' }>();

  // 🎵 Звуковое уведомление о сообщениях
  private readonly messageSound = new Audio('assets/sounds/message.mp3'); // Убрали ведущий слэш для корректной относительной адресации в продакшене

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

  constructor() {
    this.messageSound.volume = 0.4; // Чуть снизили громкость для комфорта
  }

  connect(): void {
    const token = this.getCookie('auth_token');
    const host = window.location.host;
    const protocol = window.location.protocol;

    if (typeof SharedWorker === 'undefined') {
      console.warn('⚡ [ChatService] SharedWorker не поддерживается. Запускаем фоллбэк на обычный WebSocket.');
      this.connectNormalWS(token, host, protocol);
      return;
    }

    if (this.worker) {
      return;
    }

    this.worker = new SharedWorker('/chat.worker.js', { name: 'ChatWorker' });

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

  private connectNormalWS(token: string, host: string, protocol: string): void {
    if (this.normalSocket && (this.normalSocket.readyState === WebSocket.OPEN || this.normalSocket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Очищаем старый таймер перед созданием нового подключения
    if (this.mobileReconnectTimer) {
      clearTimeout(this.mobileReconnectTimer);
      this.mobileReconnectTimer = null;
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

      // 🌟 ИСПРАВЛЕНО: Делаем реконнект безопасным. Если сокет закрыли намеренно через disconnect(), normalSocket станет null, и таймер не запустится.
      if (this.normalSocket) {
        console.warn('🔌 [Mobile WS] Соединение закрыто. Реконнект через 4 секунды...');
        this.mobileReconnectTimer = setTimeout(() => this.connectNormalWS(token, host, protocol), 4000);
      }
    };
  }

  disconnect(): void {
    // 🌟 ИСПРАВЛЕНО: Убиваем таймер реконнекта на мобилках сразу, чтобы он не выстрелил после логаута
    if (this.mobileReconnectTimer) {
      clearTimeout(this.mobileReconnectTimer);
      this.mobileReconnectTimer = null;
    }

    if (this.worker) {
      this.worker.port.postMessage({ action: 'DISCONNECT' });
      this.worker = null;
    }

    if (this.normalSocket) {
      this.normalSocket.onclose = null; // Стираем лисенер, чтобы не стриггерить OnClose реконнект
      this.normalSocket.close();
      this.normalSocket = null;
    }

    this.activeRoomId = null;
    this.connectionStatus.next(false);
    this.roomsSubject.next([]);
    this.typingUsersSubject.next({});
    this.incomingCall$.next(null);

    console.log('🔌 [ChatService] Полное отключение выполнено, локальный стейт очищен.');
  }

  sendMessage(msg: WebSocketMessage): void {
    if (this.worker) {
      this.worker.port.postMessage({ action: 'SEND_WS', payload: msg });
    }
    else if (this.normalSocket && this.normalSocket.readyState === WebSocket.OPEN) {
      this.normalSocket.send(JSON.stringify(msg));
    } else {
      console.error('❌ [ChatService] Невозможно отправить сообщение: нет активного соединения');
    }
  }

  notifyCallAnswered(roomId: string): void {
    this.incomingCall$.next(null);
    if (this.worker) {
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

          // Проверяем: пришло ли сообщение от ДРУГОГО пользователя и открыта ли сейчас эта комната
          const isOwnMessage = res.message.senderMemberId === this.auth.currentUser()?.id;
          const isCurrentRoomOpen = res.message.roomId === this.activeRoomId;

          if (!isOwnMessage && !isCurrentRoomOpen) {
            updatedRoom.unreadCount += 1;
          }

          currentRooms.splice(index, 1);
          currentRooms.unshift(updatedRoom);
          this.roomsSubject.next(currentRooms);

          // 🌟 УМНОЕ ВОСПРОИЗВЕДЕНИЕ ЗВУКА СООБЩЕНИЯ
          // Звук играет только если:
          // 1. Это не наше собственное сообщение
          // 2. Либо комната вообще закрыта, либо комната открыта, но вкладка браузера свернута/неактивна (!document.hidden)
          if (!isOwnMessage && (!isCurrentRoomOpen || document.hidden)) {
            this.playMessageSound();
          }

        } else {
          this.loadUserRooms(true);
          // Если пришло сообщение из комнаты, которой еще нет в списке (новый чат)
          if (res.message.senderMemberId !== this.auth.currentUser()?.id) {
            this.playMessageSound();
          }
        }
        break;
      }

      case 'room_read':
        this.loadUserRooms(true);
        break;
    }
  }

  // 🌟 Метод безопасного воспроизведения звука
  private playMessageSound(): void {
    this.messageSound.currentTime = 0; // Сбрасываем каретку на начало (для спам-сообщений)
    this.messageSound.play().catch(err => {
      // Ловим блокировки автоплея браузеров, если пользователь еще ни разу не кликнул по странице
      console.warn('[ChatService] Звук уведомления заблокирован политикой браузера:', err);
    });
  }

  // ==========================================
  // HTTP REST API METHODS
  // ==========================================

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
