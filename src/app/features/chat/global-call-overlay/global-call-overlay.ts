import { Component, inject, effect } from '@angular/core';
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

  // 🎵 Создаем объект аудио для рингтона
  private readonly ringtone = new Audio('/assets/sounds/ringtone.mp3');

  constructor() {
    // Включаем бесконечный повтор (loop), пока звонок активен
    this.ringtone.loop = true;

    // 🔄 Эффект Angular: автоматически следит за сигналом звонка
    effect(() => {
      const callData = this.call();

      if (callData) {
        this.startRinging();
      } else {
        this.stopRinging();
      }
    });
  }

  private startRinging(): void {
    this.ringtone.currentTime = 0; // Сбрасываем дорожку на начало

    // Блокируем возможные ошибки политик автоплея браузера
    this.ringtone.play().catch(error => {
      console.warn(
        '⚠️ [Ringtone] Браузер заблокировал автовоспроизведение звука. ' +
        'Звук пойдет, как только пользователь кликнет в любом месте экрана.',
        error
      );
    });
  }

  private stopRinging(): void {
    this.ringtone.pause();
    this.ringtone.currentTime = 0;
  }

  accept(callData: any): void {
    const roomId = callData?.roomId || callData?.room_id;
    const sdp = callData?.sdp || callData?.offer_sdp;
    const callType = callData?.callType || callData?.call_type || 'VIDEO';

    if (!roomId) {
      console.error('🛑 Ошибка: Бэкенд не прислал ID комнаты во входящем звонке!', callData);
      return;
    }

    // Мгновенно тушим рингтон при клике на кнопку
    this.stopRinging();

    // 1. Сообщаем воркеру синхронизировать состояние (закрыть оверлеи на других вкладках)
    this.chatService.notifyCallAnswered(roomId);

    // 2. Сохраняем данные звонка в кэш сервиса
    (this.chatService as any).acceptedCallData = { roomId, sdp, callType };

    // 3. Дублируем команду через Subject
    this.chatService.acceptCallCommand$.next({ roomId, sdp, callType });

    // 4. Перенаправляем пользователя в целевое окно чата
    void this.router.navigate(['/chat', roomId]);
  }

  decline(callData: any): void {
    const roomId = callData?.roomId || callData?.room_id;

    if (!roomId) {
      console.error('🛑 Ошибка отмены: не найден ID комнаты', callData);
      return;
    }

    // Мгновенно тушим рингтон
    this.stopRinging();

    // Отправляем бэкенду сигнал завершения/отклонения звонка
    this.chatService.sendCallEnd(roomId);

    // Сбрасываем локальное состояние входящего вызова
    this.chatService.incomingCall$.next(null);
  }
}
