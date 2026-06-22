import { Component, computed, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarService } from '../../services/sidebar.service';
import { ThemeService } from '../../services/theme.service';
import { TranslocoModule, TranslocoService } from '@ngneat/transloco';
import { filter, map, startWith } from 'rxjs';
import { AsyncPipe, UpperCasePipe } from '@angular/common';
import { LanguageService } from '@core/services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [AsyncPipe, UpperCasePipe, TranslocoModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {
  private readonly authService = inject(AuthService);
  protected readonly languageService = inject(LanguageService); // Сделал protected для шаблона
  private readonly router = inject(Router);
  protected readonly sidebarService = inject(SidebarService);
  protected readonly themeService = inject(ThemeService);
  private readonly translocoService = inject(TranslocoService);

  readonly currentWorkspaceName = computed(() => this.authService.currentWorkspace()?.name ?? '');

  readonly isAuthPage$ = this.router.events.pipe(
    filter(event => event instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.includes('/login') || this.router.url.includes('/register'))
  );

  // Теперь реактивно берем язык напрямую из нашего сигнала
  get activeLang(): string {
    return this.languageService.language();
  }

  toggleLanguage() {
    // Вся магия теперь под капотом одного метода
    this.languageService.toggleLanguage();
  }

  onLogout() {
    const confirmMsg = this.translocoService.translate('auth.logoutConfirmation') || 'Вы уверены, что хотите выйти из системы?';

    if (confirm(confirmMsg)) {
      this.authService.logout().subscribe({
        next: () => {
          void this.router.navigate(['/login']);
        },
        error: (err) => {
          console.error('Logout error', err);
        }
      });
    }
  }
}
