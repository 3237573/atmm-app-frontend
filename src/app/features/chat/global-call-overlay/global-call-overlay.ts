import {Component, effect, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {ChatService} from '@core/services/chat/chat.service';
import {TranslocoModule} from '@ngneat/transloco';

@Component({
  selector: 'app-global-call-overlay',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './global-call-overlay.html',
  styleUrls: ['./global-call-overlay.scss']
})
export class GlobalCallOverlay {
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);

  // Стримим оба состояния из единого сервиса чата в Angular Signals
  protected readonly incomingCall = toSignal(this.chatService.incomingCall$);
  protected readonly outgoingCall = toSignal(this.chatService.outgoingCall$);

  // 🎵 Звуковое сопровождение
  private readonly ringtone = new Audio('/assets/sounds/ringtone.mp3');
  private readonly dialtone = new Audio('/assets/sounds/dialtone.mp3');

  constructor() {
    this.ringtone.loop = true;
    this.dialtone.loop = true;

    // 🔄 Эффект 1: Контроль входящего рингтона
    effect(() => {
      if (this.incomingCall()) {
        this.startAudio(this.ringtone);
      } else {
        this.stopAudio(this.ringtone);
      }
    });

    // 🔄 Эффект 2: Контроль исходящих гудков (dialtone)
    effect(() => {
      if (this.outgoingCall()) {
        this.startAudio(this.dialtone);
      } else {
        this.stopAudio(this.dialtone);
      }
    });
  }

  private startAudio(audio: HTMLAudioElement): void {
    audio.currentTime = 0;
    audio.play().catch(error => {
      console.warn('⚠️ [Audio Autoplay] Воспроизведение заблокировано до первого клика по экрану', error);
    });
  }

  private stopAudio(audio: HTMLAudioElement): void {
    audio.pause();
    audio.currentTime = 0;
  }

  // ==========================================
  // ЛОГИКА ВХОДЯЩЕГО ЗВОНКА
  // ==========================================

  accept(callData: any): void {
    const roomId = callData?.roomId;
    const sdp = callData?.sdp;
    const callType = callData?.callType || 'VIDEO';

    if (!roomId) return;

    this.stopAudio(this.ringtone);
    this.chatService.notifyCallAnswered(roomId);

    (this.chatService as any).acceptedCallData = { roomId, sdp, callType };
    this.chatService.acceptCallCommand$.next({ roomId, sdp, callType });

    void this.router.navigate(['/chat', roomId]);
  }

  decline(callData: any): void {
    const roomId = callData?.roomId;
    if (!roomId) return;

    this.stopAudio(this.ringtone);
    this.chatService.sendCallEnd(roomId);
    this.chatService.incomingCall$.next(null);
  }

  // ==========================================
  // ЛОГИКА ИСХОДЯЩЕГО ЗВОНКА
  // ==========================================

  cancelOutgoing(outgoingData: any): void {
    const roomId = outgoingData?.roomId;
    if (!roomId) return;

    this.stopAudio(this.dialtone);

    // Посылаем сигнал бэкенду, чтобы у получателя тоже закрылся входящий оверлей
    this.chatService.sendCallEnd(roomId);
    // Гасим локальный стейт гудков
    this.chatService.outgoingCall$.next(null);
  }
}
