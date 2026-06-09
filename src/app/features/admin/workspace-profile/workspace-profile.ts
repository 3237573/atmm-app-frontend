import { Component, computed, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IWorkspace } from '../../../core/models/workspace.model';
import { WorkspaceService } from '../../../core/services/workspace.service';
import { finalize, Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { BackOnEscapeDirective } from '../../../core/directives/back-on-escape.directive';

@Component({
  selector: 'app-workspace-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, ClipboardModule, BackOnEscapeDirective],
  templateUrl: './workspace-profile.html',
  styleUrls: ['./workspace-profile.scss'],
})
export class WorkspaceProfile implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly workspaceService = inject(WorkspaceService);
  private readonly destroy$ = new Subject<void>();

  copySuccess = false;
  canEdit = computed(() => this.authService.hasPermission('workspace:update'));

  workspace: IWorkspace = { name: '', code: '', owner: { email: '', displayName: '' }, status: 'ACTIVE' };
  loading = true;
  saving = false;
  editing = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loadWorkspace();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCopy(): void {
    this.copySuccess = true;
    setTimeout(() => {
      this.copySuccess = false;
    }, 2000);
  }

  loadWorkspace(): void {
    this.loading = true;
    this.workspaceService.getWorkspace()
      .pipe(takeUntil(this.destroy$), finalize(() => this.loading = false))
      .subscribe({
        next: data => this.workspace = data,
        error: () => this.errorMessage = 'Не удалось загрузить данные пространства'
      });
  }

  saveChanges(): void {
    if (!this.canEdit()) return;

    const name = this.workspace.name?.trim();
    const code = this.workspace.code?.trim();

    if (!name || !code) {
      this.errorMessage = 'Все поля обязательны для заполнения';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.workspaceService.updateWorkspace({ name, code })
      .pipe(takeUntil(this.destroy$), finalize(() => this.saving = false))
      .subscribe({
        next: updated => {
          this.workspace = { ...this.workspace, ...updated };
          this.successMessage = 'Данные успешно обновлены';
          this.editing = false;
          setTimeout(() => this.successMessage = '', 3000);
        },
        error: err => this.errorMessage = err.error?.message || 'Ошибка сохранения'
      });
  }

  cancelEditing(): void {
    this.editing = false;
    this.loadWorkspace();
  }
}
