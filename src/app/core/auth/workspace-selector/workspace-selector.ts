import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router'; // ✨ Импортируем Router
import {AuthService} from '../../services/auth.service';
import {WorkspaceInfo} from '../../models/auth.model';
import {NavigationService} from '@core/services/navigation.service';
import {TranslocoPipe, TranslocoService} from '@ngneat/transloco';

@Component({
  selector: 'app-workspace-selector',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './workspace-selector.html',
  styleUrls: ['./workspace-selector.scss']
})
export class WorkspaceSelector {
  private readonly authService = inject(AuthService);
  private readonly navService = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly translocoService = inject(TranslocoService);

  loading = signal(false);
  workspaces = this.authService.availableWorkspaces;

  getRoleLabel(role: string): string {
    switch (role) {
      case 'OWNER':
        // Используем перевод по ключу 'auth.space.changeAccount'
        return this.translocoService.translate('auth.role.owner');
      case 'ADMIN':
        // Тоже можно вынести в JSON-файл перевода, например 'roles.admin'
        return this.translocoService.translate('auth.role.admin');
      case 'MEMBER':
        return this.translocoService.translate('auth.role.member');
      case 'GUEST':
        return this.translocoService.translate('auth.role.guest');
      default:
        return role; // или перевести ключ по умолчанию
    }
  }

  selectWorkspace(workspace: WorkspaceInfo): void {
    if (!workspace.memberId) {
      console.error('No memberId for workspace', workspace);
      return;
    }

    this.loading.set(true);
    this.authService.selectWorkspace(workspace.workspaceId, workspace.memberId).subscribe({
      next: () => {
        this.loading.set(false);
        // ✨ Успешно выбрали пространство -> переходим в приложение!
        void this.router.navigate([this.navService.getLastRoute() ?? '/tracker']);
      },
      error: (err) => {
        console.error('Error selecting workspace', err);
        this.loading.set(false);
      }
    });
  }

  backToLogin() {
    this.authService.resetToLogin();
  }

  protected readonly email = computed(() => this.authService.currentUser()?.email || '');
}
