// core/services/chat.service.ts
import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {AuthService} from './auth.service';
import {ChatMessage, ChatRoomRO, CreateChatRoomRequest, WebSocketMessage, WebSocketResponse} from '@core/models/chat.model';

interface IncomingCall {
  roomId: string;
  callType: 'VIDEO' | 'AUDIO';
  sdp: string;
}

@Injectable({providedIn: 'root'})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = '/v1/chat';
  private activeRoomId: string | null = null;
  private worker: SharedWorker | null = null;

  public readonly acceptCallCommand$ = new Subject<{roomId: string, sdp: string, callType: 'VIDEO' | 'AUDIO'}>();
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
    if (typeof SharedWorker === 'undefined') {
      console.warn('SharedWorker не поддерживается браузером, нужен фоллбэк на обычный WS');
      return;
    }

    // 🛑 КРИТИЧЕСКИЙ ГВАРД: Если воркер для этой вкладки уже создан, не создаем его заново!
    if (this.worker) {
      return;
    }

    this.worker = new SharedWorker('/chat.worker.js', {name: 'ChatWorker'});

    // 🔄 Автоматически удаляем порт из воркера, если вкладка закрывается или обновляется (F5)
    window.addEventListener('beforeunload', () => {
      if (this.worker) {
        this.worker.port.postMessage({action: 'UNLOAD_PORT'});
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
        }
        else if (response.type === 'call_ended') {
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
      token: this.getCookie('auth_token'),
      host: window.location.host,
      protocol: window.location.protocol
    });
  }

  disconnect(): void {
    if (this.worker) {
      this.worker.port.postMessage({action: 'DISCONNECT'});
      this.worker = null; // 🛑 ОБЯЗАТЕЛЬНО зануляем ссылку, чтобы очистить память вкладки
    }
    this.connectionStatus.next(false);
    this.typingUsersSubject.next({});
  }

  sendMessage(msg: WebSocketMessage): void {
    if (this.worker) {
      // ИСПРАВЛЕНО: Экшен изменен на 'SEND', чтобы соответствовать switch-case в chat.worker.js
      this.worker.port.postMessage({action: 'SEND_WS', payload: msg});
    }
  }

  // Вызывается из компонента, когда пользователь жмет "Ответить"
  notifyCallAnswered(roomId: string): void {
    this.incomingCall$.next(null); // Убираем модалку локально
    if (this.worker) {
      // Говорим воркеру, чтобы он закрыл модалки в других вкладках
      this.worker.port.postMessage({action: 'CALL_ANSWERED_LOCALLY', payload: {roomId}});
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
        room.id === roomId ? {...room, unreadCount: 0} : room
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
        room.id === roomId ? {...room, unreadCount: 0} : room
      );
      this.roomsSubject.next(updatedRooms);
    }

    // ИСПРАВЛЕНО: Отправляем событие чтения через sendMessage (воркер), а не несуществующий socket$
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
        const currentMap = {...this.typingUsersSubject.value};
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
          const updatedRoom = {...currentRooms[index]};
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
    return this.http.post<void>(`${this.baseUrl}/rooms/${roomId}/members`, {memberIds});
  }

  removeMember(roomId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/rooms/${roomId}/members/${memberId}`);
  }

  getMessages(roomId: string, limit = 50, offset = 0): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.baseUrl}/rooms/${roomId}/messages`, {
      params: {limit, offset}
    });
  }

  uploadMedia(roomId: string, file: File): Observable<ChatMessage> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ChatMessage>(`${this.baseUrl}/upload/${roomId}`, formData);
  }

  // ==========================================
  // WEBRTC SIGNALING METHODS (ИСПРАВЛЕНЫ НА sendMessage)
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

  sendCallIce(roomId: string, candidate: string): void {
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
