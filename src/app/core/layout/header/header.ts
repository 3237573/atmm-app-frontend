import { Component, computed, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service'; // Проверьте путь к вашему сервису!
import { ThemeService } from '../../services/theme.service';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { filter, map, startWith } from 'rxjs';
import { AsyncPipe, UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, UpperCasePipe, TranslocoModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly sidebarService = inject(SidebarService); // Сервис для отслеживания линии
  protected readonly themeService = inject(ThemeService);
  private readonly translocoService = inject(TranslocoService);


  // Если у вас возвращается имя воркспейса из другого сигнала/сервиса, используйте его:
  readonly currentWorkspaceName = computed(() => this.authService.currentWorkspace()?.name ?? '');

  readonly isAuthPage$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.includes('/login') || this.router.url.includes('/register'))
  );

  get activeLang(): string {
    return this.translocoService.getActiveLang();
  }

  toggleLanguage() {
    const newLang = this.activeLang === 'ru' ? 'en' : 'ru';
    this.translocoService.setActiveLang(newLang);
  }

  onLogout() {
    // Получаем строку перевода или используем дефолтный текст
    const confirmMsg = this.translocoService.translate('auth.logoutConfirmation') || 'Вы уверены, что хотите выйти из системы?';

    if (confirm(confirmMsg)) {
      this.authService.logout().subscribe({
        next: () => {
          this.router.navigate(['/login']);
        },
        error: (err) => {
          console.error('Logout error', err);
        }
      });
    }
  }
}
