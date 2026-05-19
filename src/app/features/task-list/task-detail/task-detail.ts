import {Component, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {AuthService} from '../../../core/services/auth.service';
import {TaskService} from '../../../core/services/task.service';
import {MemberService} from '../../../core/services/member.service'; // Добавили импорт
import {TaskAttachmentRO, TaskPriority, TaskRO, TaskStatus, TaskTreeRO} from '../../../core/models/task/task.model';
import {TaskComments} from './task-comments/task-comments';
import {AssigneeManager} from './assignee-manager/assignee-manager';
import {SubtaskTreeComponent} from './subtask-tree';
import {BackOnEscapeDirective} from '../../../core/directives/back-on-escape.directive';
import {NavigationService} from '../../../core/services/navigation.service';
import {ProjectAffiliation} from '../../../core/models/project.model';
import {DepartmentService} from '../../../core/services/departament.service';
import {DepartmentAffiliation} from '../../../core/models/departament.model';
import {MemberRO} from '../../../core/models/member.model';
import {AttachmentManager} from './attachment-manager/attachment-manager'; // Добавили модель проектов

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TaskComments, AssigneeManager, SubtaskTreeComponent, BackOnEscapeDirective, AttachmentManager],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss'
})
export class TaskDetail implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly departmentService = inject(DepartmentService);
  private readonly memberService = inject(MemberService); // Добавили инжект
  private readonly navService = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskService = inject(TaskService);

  currentUser = this.authService.currentUser;
  task = signal<TaskRO | null>(null);
  taskTree = signal<TaskTreeRO | null>(null);
  userDepartments = signal<DepartmentAffiliation[]>([]);
  userProjects = signal<ProjectAffiliation[]>([]);
  departmentMembers = signal<MemberRO[]>([]);
  selectedDepartmentId = signal<string>('');   // ← теперь это основной источник departmentId

  loading = signal(true);
  editing = signal(false);
  saving = signal(false);
  deleting = signal(false);
  showAssigneeModal = signal(false);
  reloadComments = signal(0);

  // Расширили originalData и editData свойством projectId
  private originalData = { title: '', description: '', priority: '' as TaskPriority, status: '' as TaskStatus, dueDate: '', projectId: '' };
  editData = { title: '', description: '', priority: '' as TaskPriority, status: '' as TaskStatus, dueDate: '', projectId: '' };
  minDate: string = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
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
    this.editing.set(false);

    this.taskService.getTaskTree(id).subscribe({
      next: (tree) => {
        this.taskTree.set(tree);
        this.task.set(tree.task);
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
    this.editing.set(false);
    const currentTaskId = this.task()?.id;

    if (currentTaskId) {
      console.log('Пытаемся перейти на создание подзадачи. ID:', currentTaskId);
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
        dueDate: task.dueDate?.split('T')[0] || '',
        projectId: (task as any).projectId || '' // Извлекаем projectId, если он есть в ответе
      };
      this.editData = { ...this.originalData };

      // Подгружаем проекты текущего пользователя, чтобы он мог выбрать только свои проекты
      if (this.userProjects().length === 0) {
        this.memberService.getMembers().subscribe(data => {
          const me = data.find(m => m.id === this.currentUser()?.id);
          if (me) {
            this.userProjects.set(me.projects || []);
          }
        });
      }

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

    // Передаем измененный projectId на бэкенд
    this.taskService.updateTask(task.id, {
      title: this.editData.title,
      description: this.editData.description,
      priority: this.editData.priority,
      status: this.editData.status,
      dueDate: this.editData.dueDate || undefined,
      projectId: this.editData.projectId || null // Добавили отправку проекта
    } as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadTaskData(task.id);
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
  canManageAssignees(): boolean {
    const task = this.task();
    if (!task) return false;
    return task.creatorMembershipId === this.currentUser()?.id;
  }

  canEditTask(): boolean {
    const task = this.task();
    if (!task) return false;
    return true;
  }

  // Обновили проверку изменений на наличие projectId
  hasUnsavedChanges(): boolean {
    if (!this.editing()) return false;
    const task = this.task();
    if (!task) return false;

    return (
      this.editData.title !== this.originalData.title ||
      this.editData.description !== this.originalData.description ||
      this.editData.priority !== this.originalData.priority ||
      this.editData.status !== this.originalData.status ||
      this.editData.dueDate !== this.originalData.dueDate ||
      this.editData.projectId !== this.originalData.projectId // Проверка изменения проекта
    );
  }

  canDeactivate(): boolean {
    if (!this.editing() || !this.hasUnsavedChanges()) {
      return true;
    }
    return confirm('У вас есть несохраненные изменения. Выйти без сохранения?');
  }

  openAssigneeModal(): void { this.showAssigneeModal.set(true); }
  closeAssigneeModal(): void { this.showAssigneeModal.set(false); }
  onAssigneesUpdated(): void { this.closeAssigneeModal(); this.loadTaskData(this.task()!.id); }
  triggerCommentsReload(): void { this.reloadComments.update(v => v + 1); }
  isOverdue(dueDate: string | undefined): boolean { return false; }

  formatAssigneeName(names: string | string[] | undefined): string {
    if (!names || (Array.isArray(names) && names.length === 0)) return 'Не назначен';

    const user = this.currentUser();
    const currentUserName = user?.displayName || user?.fullName || '';

    const namesArray = Array.isArray(names) ? names : names.split(',').map(n => n.trim());

    return namesArray
      .map(name => name === currentUserName ? 'Я' : name)
      .join(', ');
  }

  getPriorityColor(p: TaskPriority): string { return 'priority-' + p.toLowerCase(); }
  getPriorityLabel(p: TaskPriority): string { return p; }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  goBack() {
    this.navService.back('/tasks');
  }
}
