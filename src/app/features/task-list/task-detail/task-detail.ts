import {Component, inject, OnInit, OnDestroy, signal, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TaskService } from '../../../core/services/task.service';
import { MemberService } from '../../../core/services/member.service';
import { TaskPriority, TaskRO, TaskStatus, TaskTreeRO } from '../../../core/models/task/task.model';
import { TaskComments } from './task-comments/task-comments';
import { AssigneeManager } from './assignee-manager/assignee-manager';
import { SubtaskTreeComponent } from './subtask-tree';
import { BackOnEscapeDirective } from '../../../core/directives/back-on-escape.directive';
import { NavigationService } from '../../../core/services/navigation.service';
import { ProjectAffiliation } from '../../../core/models/project.model';
import { AttachmentManager } from './attachment-manager/attachment-manager';
import { ReplaceMePipe } from '../../../core/pipes/replace-me.pipe';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { ComponentDeactivateService } from '../../../core/services/component-deactivate.service';
import { CanComponentDeactivate } from '../../../core/interfaces/can-deactivate.interface';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TaskComments, AssigneeManager,
    SubtaskTreeComponent, BackOnEscapeDirective, AttachmentManager, ReplaceMePipe, HasPermissionDirective],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss'
})
export class TaskDetail implements OnInit, OnDestroy, CanComponentDeactivate {
  private readonly authService = inject(AuthService);
  private readonly memberService = inject(MemberService);
  private readonly navService = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskService = inject(TaskService);
  private readonly deactivateService = inject(ComponentDeactivateService);

  currentUser = this.authService.currentUser;
  task = signal<TaskRO | null>(null);
  taskTree = signal<TaskTreeRO | null>(null);
  userProjects = signal<ProjectAffiliation[]>([]);
  loading = signal(true);
  editing = signal(false);
  saving = signal(false);
  subtasksExpanded = signal(false);
  deleting = signal(false);
  showAssigneeModal = signal(false);
  reloadComments = signal(0);

  // Список доступных родительских задач (для переноса)
  availableParentTasks = signal<{ id: string; title: string }[]>([]);

  // Данные формы редактирования
  private originalData = {
    title: '',
    description: '',
    priority: '' as TaskPriority,
    status: '' as TaskStatus,
    dueDate: '',
    projectId: '',
    parentTaskId: null as string | null
  };
  editData = {
    title: '',
    description: '',
    priority: '' as TaskPriority,
    status: '' as TaskStatus,
    dueDate: '',
    projectId: '',
    parentTaskId: null as string | null
  };
  minDate: string = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    this.deactivateService.register(this);
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.loadTaskData(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.deactivateService.unregister();
  }

  loadTaskData(id: string): void {
    this.loading.set(true);
    this.editing.set(false);

    this.taskService.getTaskTree(id).subscribe({
      next: (tree) => {
        this.taskTree.set(tree);
        this.task.set(tree.task);
        this.loading.set(false);
        // Загружаем список возможных родителей для переноса
        this.loadAvailableParents();
      },
      error: (err) => {
        console.error('Ошибка загрузки задачи', err);
        this.loading.set(false);
        this.router.navigate(['/tasks']);
      }
    });
  }

  /** Загружает все задачи пользователя и формирует список кандидатов в родители (исключая текущую и её потомков) */
  loadAvailableParents(): void {
    const currentTask = this.task();
    if (!currentTask) return;

    this.taskService.getMyTaskTree().subscribe({
      next: (trees) => {
        const allTasks = this.flattenTaskTree(trees);
        // Получаем всех потомков текущей задачи (включая подзадачи всех уровней)
        const descendantIds = this.getAllDescendantIds(this.taskTree()?.subtasks || []);
        const excludeIds = new Set([currentTask.id, ...descendantIds]);

        const available = allTasks
          .filter(t => !excludeIds.has(t.id))
          .map(t => ({ id: t.id, title: t.title }));

        this.availableParentTasks.set(available);
      },
      error: (err) => console.error('Ошибка загрузки списка задач для переноса', err)
    });
  }

  private flattenTaskTree(trees: TaskTreeRO[]): TaskRO[] {
    const result: TaskRO[] = [];
    const traverse = (nodes: TaskTreeRO[]) => {
      for (const node of nodes) {
        result.push(node.task);
        if (node.subtasks?.length) traverse(node.subtasks);
      }
    };
    traverse(trees);
    return result;
  }

  private getAllDescendantIds(subtasks: TaskTreeRO[]): string[] {
    const ids: string[] = [];
    const collect = (nodes: TaskTreeRO[]) => {
      for (const node of nodes) {
        ids.push(node.task.id);
        if (node.subtasks?.length) collect(node.subtasks);
      }
    };
    collect(subtasks);
    return ids;
  }

  parentTaskTitleDisplay = computed(() => {
    const task = this.task();
    if (!task) return null;
    if (!task.parentTaskId) return null;
    // Если бэкенд вернул title – используем его
    if (task.parentTaskTitle) return task.parentTaskTitle;
    // Иначе ищем в загруженном списке доступных родителей
    const found = this.availableParentTasks().find(p => p.id === task.parentTaskId);
    return found ? found.title : 'Загрузка...';
  });

  createSubtask() {
    this.editing.set(false);
    const currentTaskId = this.task()?.id;
    if (currentTaskId) {
      this.router.navigate(['/tasks/create'], {
        queryParams: { parentId: currentTaskId }
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
        projectId: (task as any).projectId || '',
        parentTaskId: task.parentTaskId || null
      };
      this.editData = { ...this.originalData };

      // Загружаем проекты пользователя, если ещё не загружены
      if (this.userProjects().length === 0) {
        this.memberService.getMembers().subscribe(data => {
          const me = data.find(m => m.id === this.currentUser()?.id);
          if (me) {
            this.userProjects.set(me.projects || []);
          }
        });
      }

      // Если список родителей пуст, загружаем его (актуально при первом редактировании)
      if (this.availableParentTasks().length === 0) {
        this.loadAvailableParents();
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

    // Сначала обновляем основные поля задачи
    this.taskService.updateTask(task.id, {
      title: this.editData.title,
      description: this.editData.description,
      priority: this.editData.priority,
      status: this.editData.status,
      dueDate: this.editData.dueDate || undefined,
      projectId: this.editData.projectId || null
    } as any).pipe(
      switchMap(() => {
        // Если изменился родитель – перемещаем задачу
        if (this.editData.parentTaskId !== this.originalData.parentTaskId) {
          return this.taskService.moveTask(task.id, this.editData.parentTaskId);
        }
        return of(null);
      })
    ).subscribe({
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

  canManageAssignees(): boolean {
    const task = this.task();
    return !!task && task.creatorMembershipId === this.currentUser()?.id;
  }

  canEditTask(): boolean {
    return !!this.task();
  }

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
      this.editData.projectId !== this.originalData.projectId ||
      this.editData.parentTaskId !== this.originalData.parentTaskId
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

  toggleSubtasks(): void {
    if (this.taskTree()?.subtasks?.length) {
      this.subtasksExpanded.update(expanded => !expanded);
    }
  }
}
