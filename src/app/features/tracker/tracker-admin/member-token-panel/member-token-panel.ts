import {Component, inject, signal, OnInit, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
  selector: 'app-member-token-panel',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './member-token-panel.html',
  styleUrls: ['./member-token-panel.scss']
})
export class MemberTokenPanel implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  memberToken = signal<string>('');
  tokenCopied = signal(false);
  isRegenerating = signal(false);
  isLoading = signal(true);
  showToken = signal(false);  // 👈 добавляем состояние для показа/скрытия токена

  canManage = computed(() => this.authService.hasPermission('tracker:read'));

  ngOnInit(): void {
    this.loadToken();
  }

  toggleShowToken(): void {
    this.showToken.update(v => !v);
  }

  loadToken(): void {
    this.isLoading.set(true);
    this.http.get<{ memberToken: string }>('/auth/me/token')
      .subscribe({
        next: (res) => {
          this.memberToken.set(res.memberToken);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Ошибка загрузки токена', err);
          this.isLoading.set(false);
        }
      });
  }

  copyToClipboard(): void {
    navigator.clipboard.writeText(this.memberToken()).then(() => {
      this.tokenCopied.set(true);
      setTimeout(() => this.tokenCopied.set(false), 2000);
    });
  }

  regenerateToken(): void {
    if (!confirm('Обновление токена сделает старый токен недействительным. Продолжить?')) return;

    this.isRegenerating.set(true);
    this.http.post<{ memberToken: string }>('/auth/me/token/regenerate', {})
      .subscribe({
        next: (res) => {
          this.memberToken.set(res.memberToken);
          this.isRegenerating.set(false);
        },
        error: (err) => {
          this.isRegenerating.set(false);
          console.error('Ошибка регенерации токена', err);
          alert('Не удалось обновить токен');
        }
      });
  }
}
