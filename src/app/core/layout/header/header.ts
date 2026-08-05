import {Component, computed, HostListener, inject, signal} from '@angular/core';
import {Router} from '@angular/router';
import {TranslocoDirective, TranslocoPipe, TranslocoService} from '@ngneat/transloco';

import {ThemeService} from '@core/services/theme.service'; // Путь может отличаться
import {WorkspaceInfoRO} from '@core/models/workspace.model';
import {AuthService} from '@core/services/auth.service';
import {SidebarService} from '@core/services/sidebar.service';
import {UpperCasePipe} from '@angular/common';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  imports: [
    TranslocoPipe,
    UpperCasePipe,
    TranslocoDirective
  ],
  styleUrls: ['./header.scss']
})
export class Header {
  // =========================================
  // 1. ЗАВИСИМОСТИ (DI)
  // Public - доступны в HTML шаблоне
  // Private - используются только внутри TS
  // =========================================
  public readonly authService = inject(AuthService);
  public readonly sidebarService = inject(SidebarService);
  public readonly themeService = inject(ThemeService);

  private readonly translocoService = inject(TranslocoService);
  private readonly router = inject(Router);

  // =========================================
  // 2. СОСТОЯНИЕ КОМПОНЕНТА (Signals)
  // =========================================
  public readonly isWorkspaceDropdownOpen = signal<boolean>(false);
  public readonly activeLang = signal<string>(this.translocoService.getActiveLang());

  // Вычисляемые сигналы на основе данных из AuthService
  public readonly currentWorkspaceName = computed(() => this.authService.currentWorkspace()?.name || '');
  public readonly currentWorkspaceId = computed(() => this.authService.currentWorkspace()?.workspaceId || '');

  // =========================================
  // 3. ПОТОКИ (Observables)
  // (Оставь здесь свою реализацию isAuthPage$, если она отличается)
  // =========================================
  public readonly isAuthenticated = this.authService.isAuthenticated;

  // =========================================
  // 4. МЕТОДЫ ЖИЗНЕННОГО ЦИКЛА И СЛУШАТЕЛИ
  // =========================================

  /** Закрывает дропдаун при клике вне области .page-title */
  @HostListener('document:click', ['$event'])
  public onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.page-title') && this.isWorkspaceDropdownOpen()) {
      this.isWorkspaceDropdownOpen.set(false);
    }
  }

  // =========================================
  // 5. ПУБЛИЧНЫЕ МЕТОДЫ (Вызываются из HTML)
  // =========================================

  public toggleWorkspaceDropdown(): void {
    this.isWorkspaceDropdownOpen.update(isOpen => !isOpen);
  }

  public changeWorkspace(workspace: WorkspaceInfoRO): void {
    this.isWorkspaceDropdownOpen.set(false);

    // Если кликнули на тот же самый воркспейс — ничего не делаем
    if (workspace.workspaceId === this.currentWorkspaceId()) {
      return;
    }

    // 🌟 ИСПРАВЛЕНИЕ ОШИБКИ TS2554: Передаем единый объект SelectWorkspaceRO
    this.authService.selectWorkspace({
      workspaceId: workspace.workspaceId,
      memberId: workspace.memberId
    }).subscribe({
      next: () => {
        // Перезагрузка гарантирует сброс контекста старого воркспейса и загрузку нового
        window.location.reload();
      },
      error: (err) => {
        console.error('Ошибка переключения воркспейса', err);
      }
    });
  }

  public toggleLanguage(): void {
    const newLang = this.activeLang() === 'ru' ? 'en' : 'ru';
    this.translocoService.setActiveLang(newLang);
    this.activeLang.set(newLang);
  }

  public onLogout(): void {
    this.authService.logout().subscribe();
  }
}
