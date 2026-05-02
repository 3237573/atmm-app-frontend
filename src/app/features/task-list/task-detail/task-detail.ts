import {Component, inject, OnInit, signal, OnDestroy, HostListener} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth/auth.service';
import { TaskService } from '../../../core/services/task/task.service';
import { TaskRO, TaskPriority, TaskStatus } from '../../../core/models/task/task.model';
import { TaskComments } from './task-comments/task-comments';
import { AssigneeManager } from './assignee-manager/assignee-manager';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TaskComments, AssigneeManager],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss'
})
export class TaskDetail implements OnInit, OnDestroy {
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  currentMembership = this.authService.currentMembership;

  // State signals
  task = signal<TaskRO | null>(null);
  loading = signal(true);
  editing = signal(false);
  saving = signal(false);
  deleting = signal(false);
  showAssigneeModal = signal(false);
  reloadComments = signal(0);

  // Unsaved changes tracking
  private originalData = {
    title: '',
    description: '',
    priority: '' as TaskPriority,
    status: '' as TaskStatus,
    dueDate: ''
  };

  editData = {
    title: '',
    description: '',
    priority: '' as TaskPriority,
    status: '' as TaskStatus,
    dueDate: ''
  };

  minDate: string = new Date().toISOString().split('T')[0];



  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTask(id);
    }
  }

  ngOnDestroy(): void {
    // No need - canDeactivate handles navigation
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.goBack();
  }

  // ========== PERMISSIONS ==========

  canManageAssignees(): boolean {
    const task = this.task();
    if (!task) return false;
    const currentMembershipId = this.currentMembership()?.id;
    const isCreator = currentMembershipId === task.creatorMembershipId;
    const hasPermission = this.authService.hasPermission('task:assign');
    return isCreator || hasPermission;
  }

  canEditTask(): boolean {
    const task = this.task();
    if (!task) return false;
    const currentMembershipId = this.currentMembership()?.id;
    return currentMembershipId === task.creatorMembershipId;
  }

  // ========== UNSAVED CHANGES ==========

  hasUnsavedChanges(): boolean {
    if (!this.editing()) return false;

    return this.editData.title !== this.originalData.title ||
      this.editData.description !== this.originalData.description ||
      this.editData.priority !== this.originalData.priority ||
      this.editData.status !== this.originalData.status ||
      this.editData.dueDate !== this.originalData.dueDate;
  }

  canDeactivate(): boolean {
    if (this.editing() && this.hasUnsavedChanges()) {
      return confirm('Есть несохранённые изменения. Вы уверены, что хотите уйти?');
    }
    return true;
  }

  // ========== TASK CRUD ==========

  loadTask(id: string): void {
    this.loading.set(true);
    this.taskService.getTaskById(id).subscribe({
      next: (data) => {
        this.task.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки задачи', err);
        this.loading.set(false);
        this.router.navigate(['/tasks']);
      }
    });
  }

  startEdit(): void {
    const task = this.task();
    if (task) {
      const dueDateFormatted = task.dueDate?.split('T')[0] || '';

      this.originalData = {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status,
        dueDate: dueDateFormatted
      };

      this.editData = { ...this.originalData };
      this.editing.set(true);
    }
  }

  cancelEdit(): void {
    if (this.hasUnsavedChanges()) {
      if (confirm('Есть несохранённые изменения. Отменить редактирование?')) {
        this.editing.set(false);
      }
    } else {
      this.editing.set(false);
    }
  }

  saveEdit(): void {
    const task = this.task();
    if (!task) return;

    this.saving.set(true);
    this.taskService.updateTask(task.id, {
      title: this.editData.title,
      description: this.editData.description,
      priority: this.editData.priority,
      status: this.editData.status,
      dueDate: this.editData.dueDate || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.loadTask(task.id);
        this.triggerCommentsReload();
      },
      error: (err) => {
        console.error('Ошибка сохранения', err);
        this.saving.set(false);
        alert('Ошибка сохранения задачи');
      }
    });
  }

  deleteTask(): void {
    const task = this.task();
    if (!task) return;

    if (confirm(`Удалить задачу "${task.title}"?`)) {
      this.deleting.set(true);
      this.taskService.deleteTask(task.id).subscribe({
        next: () => {
          this.deleting.set(false);
          this.router.navigate(['/tasks']);
        },
        error: (err) => {
          console.error('Ошибка удаления', err);
          this.deleting.set(false);
          alert('Ошибка удаления задачи');
        }
      });
    }
  }

  updateStatus(newStatus: string): void {
    const task = this.task();
    if (task) {
      this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
        next: () => {
          this.loadTask(task.id);
          this.triggerCommentsReload();
        },
        error: (err) => console.error('Ошибка обновления статуса', err)
      });
    }
  }

  // ========== ASSIGNEES ==========

  openAssigneeModal(): void {
    this.showAssigneeModal.set(true);
  }

  closeAssigneeModal(): void {
    this.showAssigneeModal.set(false);
  }

  onAssigneesUpdated(): void {
    this.closeAssigneeModal();
    this.loadTask(this.task()!.id);
    this.triggerCommentsReload();
  }

  // ========== HELPERS ==========

  triggerCommentsReload(): void {
    this.reloadComments.update(value => value + 1);
  }

  isOverdue(dueDate: string | undefined): boolean {
    if (!dueDate) return false;
    const task = this.task();
    return new Date(dueDate) < new Date() && task?.status !== 'COMPLETED';
  }

  formatAssigneeNames(assigneeName: string): string {
    if (!assigneeName) return 'Не назначены';

    const currentMembershipId = this.currentMembership()?.id;
    const currentUserName = this.currentMembership()?.displayName || '';

    const assignees = assigneeName.split(',').map(a => a.trim());
    const formatted = assignees.map(name => {
      if (name === currentUserName) return 'Я';
      return name;
    });

    return formatted.join(', ');
  }

  getPriorityColor(priority: TaskPriority): string {
    const colors = {
      'LOW': 'priority-low',
      'MEDIUM': 'priority-medium',
      'HIGH': 'priority-high',
      'URGENT': 'priority-urgent'
    };
    return colors[priority];
  }

  getPriorityLabel(priority: TaskPriority): string {
    const labels = {
      'LOW': 'Низкий',
      'MEDIUM': 'Средний',
      'HIGH': 'Высокий',
      'URGENT': 'Срочный'
    };
    return labels[priority];
  }

  getStatusLabel(status: TaskStatus): string {
    const labels = {
      'PENDING': 'Ожидает',
      'IN_PROGRESS': 'В работе',
      'REVIEW': 'На проверке',
      'COMPLETED': 'Выполнена',
      'ARCHIVED': 'Архив'
    };
    return labels[status];
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  goBack(): void {
    if (this.editing() && this.hasUnsavedChanges()) {
      if (confirm('Есть несохранённые изменения. Уйти без сохранения?')) {
        this.router.navigate(['/tasks']);
      }
    } else {
      this.router.navigate(['/tasks']);
    }
  }
}
