import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router'; // ✨ Импортируем Router
import {AuthService} from '../../services/auth.service';
import {WorkspaceInfo} from '../../models/auth.model';

@Component({
  selector: 'app-workspace-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workspace-selector.html',
  styleUrls: ['./workspace-selector.scss']
})
export class WorkspaceSelector {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router); // ✨ Инжектим роутер

  loading = signal(false);
  workspaces = this.authService.availableWorkspaces;

  getRoleLabel(role: string): string {
    switch (role) {
      case 'OWNER': return 'Владелец';
      case 'ADMIN': return 'Админ';
      case 'MEMBER': return 'Участник';
      case 'GUEST': return 'Гость';
      default: return role;
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
        this.router.navigate(['/tasks']);
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
