import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChatService } from '@core/services/chat.service';

@Component({
  selector: 'app-global-call-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-call-overlay.html',
  styleUrls: ['./global-call-overlay.scss']
})
export class GlobalCallOverlay {
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);

  // Превращаем BehaviorSubject во внутренний Angular Signal
  protected readonly call = toSignal(this.chatService.incomingCall$);

  accept(callData: any): void {
    // 1. Сообщаем воркеру синхронизировать состояние (закрыть оверлеи на других вкладках)
    this.chatService.notifyCallAnswered(callData.roomId);

    // 2. Перенаправляем пользователя в целевое окно чата
    // Передаем флаг autoAnswer и оригинальный sdp офер через Query Parameters
    void this.router.navigate(['/chat', callData.roomId], {
      queryParams: {
        autoAnswer: 'true',
        sdp: callData.sdp,
        callType: callData.callType || 'VIDEO'
      }
    });
  }

  decline(callData: any): void {
    // Отправляем сигнал сброса на бэкенд через WebSocket
    this.chatService.sendMessage({
      type: 'call_end',
      roomId: callData.roomId
    });
    // Скрываем оверлей на этой и всех остальных вкладках
    this.chatService.notifyCallAnswered(callData.roomId);
  }
}
