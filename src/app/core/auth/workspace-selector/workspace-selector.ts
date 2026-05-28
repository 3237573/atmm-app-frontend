import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
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

  loading = signal(false);
  workspaces = this.authService.availableWorkspaces;

  getRoleLabel(role: string): string {
    switch (role) {
      case 'OWNER': return 'Owner';
      case 'ADMIN': return 'Admin';
      case 'MEMBER': return 'Member';
      case 'GUEST': return 'Guest';
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
      error: (err) => {
        console.error('Error selecting workspace', err);
        this.loading.set(false);
      },
      complete: () => {
        this.loading.set(false);
      }
    });
  }

  backToLogin() {
    this.authService.resetToLogin();
  }

  protected readonly email = computed(() => this.authService.currentUser()?.email || '');
}
