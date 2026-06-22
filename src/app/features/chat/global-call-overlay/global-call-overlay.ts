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
    // 🔍 БЕЗОПАСНЫЙ ПАРСИНГ: проверяем и camelCase, и snake_case от бэкенда
    const roomId = callData?.roomId || callData?.room_id;
    const sdp = callData?.sdp || callData?.offer_sdp;
    const callType = callData?.callType || callData?.call_type || 'VIDEO';

    if (!roomId) {
      console.error('🛑 Ошибка: Бэкенд не прислал ID комнаты во входящем звонке!', callData);
      return;
    }

    // 1. Сообщаем воркеру синхронизировать состояние (закрыть оверлеи на других вкладках)
    this.chatService.notifyCallAnswered(roomId);

    // 2. Сохраняем данные звонка в кэш сервиса.
    // Это спасёт нас, если компонент чата ещё не инициализирован роутером!
    (this.chatService as any).acceptedCallData = { roomId, sdp, callType };

    // 3. Дублируем команду через Subject (на случай, если пользователь УЖЕ сидел в этой комнате)
    this.chatService.acceptCallCommand$.next({ roomId, sdp, callType });

    // 4. Перенаправляем пользователя в целевое окно чата (теперь roomId гарантированно строка!)
    void this.router.navigate(['/chat', roomId]);
  }

  decline(callData: any): void {
    // 🔍 Безопасно извлекаем ID комнаты
    const roomId = callData?.roomId || callData?.room_id;

    if (!roomId) {
      console.error('🛑 Ошибка отмены: не удалось определить ID комнаты!', callData);
      return;
    }

    // Отправляем сигнал сброса на бэкенд через WebSocket с ПРАВИЛЬНЫМ roomId
    this.chatService.sendMessage({
      type: 'call_end',
      roomId: roomId
    });

    // Скрываем оверлей на этой и всех остальных вкладках
    this.chatService.notifyCallAnswered(roomId);
  }
}
