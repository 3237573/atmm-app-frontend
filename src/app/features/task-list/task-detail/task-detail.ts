import {Component, HostListener, inject, OnInit, signal} from '@angular/core';
import {CommonModule, Location} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {AuthService} from '../../../core/services/auth/auth.service';
import {TaskService} from '../../../core/services/task/task.service';
import {TaskPriority, TaskRO, TaskStatus, TaskTreeRO} from '../../../core/models/task/task.model';
import {TaskComments} from './task-comments/task-comments';
import {AssigneeManager} from './assignee-manager/assignee-manager';
import {SubtaskTreeComponent} from './subtask-tree';
import {BackOnEscapeDirective} from '../../../core/directives/back-on-escape.directive';
import {NavigationService} from '../../../core/services/navigation/navigation.service';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  // ДОБАВИЛИ SubtaskTreeComponent в imports
  imports: [CommonModule, FormsModule, RouterModule, TaskComments, AssigneeManager, SubtaskTreeComponent, BackOnEscapeDirective],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss'
})
export class TaskDetail implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly navService = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskService = inject(TaskService);


  currentUser = this.authService.currentUser;

  // State signals
  task = signal<TaskRO | null>(null);
  taskTree = signal<TaskTreeRO | null>(null); // Храним дерево целиком
  loading = signal(true);
  editing = signal(false);
  saving = signal(false);
  deleting = signal(false);
  showAssigneeModal = signal(false);
  reloadComments = signal(0);

  private originalData = { title: '', description: '', priority: '' as TaskPriority, status: '' as TaskStatus, dueDate: '' };
  editData = { title: '', description: '', priority: '' as TaskPriority, status: '' as TaskStatus, dueDate: '' };
  minDate: string = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    // IMPORTANT: Subscribe to URL changes.
    // Now, when you click on a subtask, the page will refresh!
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadTaskData(id);
      }
    });
  }

  // ========== TASK CRUD ==========
  loadTaskData(id: string): void {
    this.loading.set(true);
    this.editing.set(false); // Сбрасываем режим редактирования при переходе

    this.taskService.getTaskTree(id).subscribe({
      next: (tree) => {
        this.taskTree.set(tree);
        this.task.set(tree.task); // Корень дерева - это наша текущая задача
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки задачи', err);
        this.loading.set(false);
        this.router.navigate(['/tasks']);
      }
    });
  }

  createSubtask() {
    this.editing.set(false); // Принудительно отключаем режим редактирования
    const currentTaskId = this.task()?.id;

    if (currentTaskId) {
      console.log('Пытаемся перейти на создание подзадачи. ID:', currentTaskId);

      // ВАЖНО: Слэш перед tasks обязателен!
      this.router.navigate(['/tasks/create'], {
        queryParams: { parentId: currentTaskId }
      }).then(success => {
        if (!success) console.warn('Роутер заблокировал переход (Guard вернул false)');
      }).catch(err => {
        console.error('Ошибка роутера:', err);
      });
    }
  }

  startEdit(): void {
    const task = this.task();
    if (task) {
      this.originalData = {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate?.split('T')[0] || ''
      };
      this.editData = { ...this.originalData };
      this.editing.set(true);
    }
  }

  cancelEdit(): void {
    if (this.hasUnsavedChanges() && !confirm('Отменить редактирование?')) return;
    this.editing.set(false);
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
        this.loadTaskData(task.id); // Перезагружаем дерево
        this.triggerCommentsReload();
      },
      error: () => {
        this.saving.set(false);
        alert('Ошибка сохранения задачи');
      }
    });
  }

  deleteTask(): void {
    const task = this.task();
    if (task && confirm(`Удалить задачу "${task.title}"?`)) {
      this.deleting.set(true);
      this.taskService.deleteTask(task.id).subscribe({
        next: () => this.router.navigate(['/tasks']),
        error: () => { this.deleting.set(false); alert('Ошибка удаления'); }
      });
    }
  }

  updateStatus(newStatus: string): void {
    const task = this.task();
    if (task) {
      this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
        next: () => {
          this.loadTaskData(task.id);
          this.triggerCommentsReload();
        }
      });
    }
  }

  // ========== secondary methods ==========
  // 1. Проверка прав (восстанови свою логику, если она была сложнее)
  canManageAssignees(): boolean {
    const task = this.task();
    if (!task) return false;
    // Обычно может менять либо создатель, либо владелец
    return task.creatorMembershipId === this.currentUser()?.id;
  }

  canEditTask(): boolean {
    const task = this.task();
    if (!task) return false;
    // Твоя логика прав здесь
    return true;
  }

  // 2. Исправленный метод проверки изменений (чтобы не вылетало)
  hasUnsavedChanges(): boolean {
    if (!this.editing()) return false;
    const task = this.task();
    if (!task) return false;

    // Сравниваем текущие поля в форме с оригиналом
    return (
      this.editData.title !== this.originalData.title ||
      this.editData.description !== this.originalData.description ||
      this.editData.priority !== this.originalData.priority ||
      this.editData.status !== this.originalData.status ||
      this.editData.dueDate !== this.originalData.dueDate
    );
  }

  // 3. Исправленный Guard (который не даст вылететь в логин)
  canDeactivate(): boolean {
    // Если мы не редактируем или изменений реально нет — пускаем без вопросов
    if (!this.editing() || !this.hasUnsavedChanges()) {
      return true;
    }
    // Если юзер что-то поменял и пытается уйти
    return confirm('У вас есть несохраненные изменения. Выйти без сохранения?');
  }
  openAssigneeModal(): void { this.showAssigneeModal.set(true); }
  closeAssigneeModal(): void { this.showAssigneeModal.set(false); }
  onAssigneesUpdated(): void { this.closeAssigneeModal(); this.loadTaskData(this.task()!.id); }
  triggerCommentsReload(): void { this.reloadComments.update(v => v + 1); }
  isOverdue(dueDate: string | undefined): boolean { return false; /* твой код */ }
  formatAssigneeName(assigneeName: string): string {
    if (!assigneeName) return 'Не назначен';

    const user = this.currentUser();
    if (!user) return assigneeName;

    const currentUserName = user.displayName || user.fullName || user.email?.split('@')[0] || '';

    const assignees = assigneeName.split(',').map(a => a.trim());
    const formattedAssignees = assignees.map(name => {
      if (name === currentUserName) return 'Я';
      return name;
    });

    return formattedAssignees.join(', ');
  }
  getPriorityColor(p: TaskPriority): string { return 'priority-' + p.toLowerCase(); }
  getPriorityLabel(p: TaskPriority): string { return p; }
  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  goBack() {
    this.navService.back('/tasks');
  }
}
