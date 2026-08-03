import {ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, viewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {CommonModule, formatDate as angularFormatDate} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslocoModule} from '@ngneat/transloco';
import {ReplaceMePipe} from '@core/pipes/replace-me.pipe';
import {HasPermissionDirective} from '@core/directives/has-permission.directive';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {TaskEditorComponent} from '@features/task/task-editor/task-editor';
import {AttachmentManager} from '@features/task/attachment-manager/attachment-manager';
import {SubtaskTreeComponent} from '@features/task/task-detail/subtask-tree';
import {TaskComments} from '@features/task/task-comments/task-comments';
import {ITaskUpdateRO, TaskPriority, TaskRO, TaskStatus, TaskTreeRO} from '@core/models/task/task.model';
import {TaskService} from '@core/services/task.service';
import {AssigneeManager} from '@features/task/assignee-manager/assignee-manager';
import {finalize} from 'rxjs';
import {AuthService} from '@core/services/auth.service';
import {ProjectAffiliation} from '@core/models/project.model';
import {MemberService} from '@core/services';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoModule,
    ReplaceMePipe,
    HasPermissionDirective,
    BackOnEscapeDirective,
    TaskEditorComponent,
    AttachmentManager,
    SubtaskTreeComponent,
    TaskComments,
    AssigneeManager
  ],
  templateUrl: './task-detail.html',
  styleUrls: ['./task-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskDetail implements OnInit {
  private readonly authService = inject(AuthService);
  public router = inject(Router);
  public route = inject(ActivatedRoute);

  private readonly memberService = inject(MemberService);
  private readonly taskService = inject(TaskService);

  currentUser = this.authService.currentUser;

  // Сигналы настроек доступа
  editIsPublic = signal(false);
  editIsEditableByAll = signal(false);

  loading = signal(false);
  editing = signal(false);
  saving = signal(false);
  deleting = signal(false);
  showAssigneeModal = signal(false);
  subtasksExpanded = signal(true);
  minDate = new Date().toISOString().split('T')[0];

  task = signal<TaskRO | null>(null);
  taskTree = signal<TaskTreeRO | null>(null);
  availableParentTasks = signal<TaskRO[]>([]);
  userProjects = signal<ProjectAffiliation[]>([]);
  reloadTrigger = signal(0);

  isCreator = computed(() => {
    const currentTask = this.task();
    const currentUser = this.authService.currentUser(); // или ваш способ получения текущего юзера
    if (!currentTask || !currentUser) return false;
    return currentTask.creatorId === currentUser.id;
  });
  canEdit = computed(() => {
    const currentTask = this.task();
    const currentUser = this.authService.currentUser(); // или ваш способ получения текущего юзера

    if (!currentTask || !currentUser) return false;

    // 1. Проверяем, разрешено ли редактирование всем (isEditableByAll)
    const isEditableByAll = currentTask.settings?.isEditableByAll === true;

    // 2. Проверяем, является ли пользователь создателем (creator)
    // (зависит от того, как у вас хранится ID создателя в объекте task, например creatorId или creator)
    const isCreator = currentTask.creatorId === currentUser.id;

    // 3. Проверяем, находится ли пользователь в списке исполнителей (assignees)
    // (зависит от структуры вашей модели task, например массив assignees или assigneeIds)
    // const isAssignee = currentTask.assignees?.some((a: any) => a.id === currentUser.id);

    // 4. Проверка прав администратора / глобального права (если используется)
    // const hasAdminPermission = ...

    // Итоговое условие: редактировать можно, если включен флаг isEditableByAll,
    // Либо если пользователь создатель / исполнитель (плюс ваши проверки прав)
    // return isEditableByAll || isCreator || isAssignee;
    return isEditableByAll || isCreator;
  });
  editProjectId = signal<string>('');
  editTitle = signal('');
  editDescription = signal('');
  editDueDate = signal('');
  editParentTaskId = signal<string | null>(null);
  editTaskStatus = signal<TaskStatus>('PENDING');
  editPriority = signal<TaskPriority>('LOW');

  readonly taskEditor = viewChild.required<TaskEditorComponent>('editorRef');

  selectedStatus = computed(() => this.task()?.taskStatus ?? 'PENDING');
  parentTaskTitleDisplay = computed(() => {
    const t = this.task();
    if (!t?.parentTaskId) return null;
    const p = this.availableParentTasks().find(x => x.id === t.parentTaskId);
    return p?.title ?? t.parentTaskTitle ?? null;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadTask(id);
  }

  private loadTask(id: string): void {
    this.loading.set(true);
    this.taskService.getTaskById(id).pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (data) => {
        this.task.set(data);
        this.editTitle.set(data.title);
        this.editDescription.set(data.description ?? '');
        this.editDueDate.set(data.dueDate ?? '');
        this.editParentTaskId.set(data.parentTaskId ?? null);
        this.editTaskStatus.set(data.taskStatus);
        this.editPriority.set(data.priority);
        this.editIsPublic.set(data.settings?.isPublic ?? false);
        this.editIsEditableByAll.set(data.settings?.isEditableByAll ?? false);

        this.taskService.getTaskTree(id).subscribe({
          next: (tree) => this.taskTree.set(tree),
          error: (err) => console.error('Tree Loading Error:', err)
        });
        this.editProjectId.set(data.projectId ?? '');
        this.computeParents();
        this.computeProjects();
      },
      error: (err) => console.error('Error loading task:', err)
    });
  }

  private computeParents(): void {
    const currentTask = this.task();
    if (!currentTask) return;

    this.taskService.getMyTaskTree().subscribe({
      next: (trees) => {
        const allTasks = this.flattenTaskTree(trees);
        const descendantIds = this.getAllDescendantIds(this.taskTree()?.subtasks || []);
        const excludeIds = new Set([currentTask.id, ...descendantIds]);

        const availableTasks = allTasks.filter(t => !excludeIds.has(t.id));

        this.availableParentTasks.set(availableTasks);
      },
      error: (err) => console.error('Ошибка загрузки списка задач для переноса', err)
    });
  }

  private computeProjects(): void {
    this.memberService.getMembers().subscribe(data => {
      const me = data.find(m => m.id === this.currentUser()?.id);
      if (me) {
        this.userProjects.set(me.projects || []);
      }
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

  startEdit(): void {
    this.editing.set(true);
    if (this.userProjects().length === 0) {
      this.computeProjects();
    }

    if (this.availableParentTasks().length === 0) {
      this.computeParents();
    }
  }

  cancelEdit(): void {
    const t = this.task();
    if (t) {
      this.editTitle.set(t.title);
      this.editDescription.set(t.description ?? '');
      this.editDueDate.set(t.dueDate ?? '');
      this.editParentTaskId.set(t.parentTaskId ?? null);
      this.editTaskStatus.set(t.taskStatus);
      this.editPriority.set(t.priority);
      this.editIsPublic.set(t.settings?.isPublic ?? false);
      this.editIsEditableByAll.set(t.settings?.isEditableByAll ?? false);
      this.taskEditor().setContent(t.description ?? '');
      this.editProjectId.set(t.projectId ?? '');
    }
    this.editing.set(false);
  }

  saveEdit(): void {
    const t = this.task();
    if (!t) return;

    const payload: Partial<ITaskUpdateRO> = {
      title: this.editTitle(),
      description: this.taskEditor().getHTML(),
      status: this.editTaskStatus() || undefined,
      priority: this.editPriority() || undefined,
      dueDate: this.editDueDate() || undefined,
      parentTaskId: this.editParentTaskId() || undefined,
      projectId: this.editProjectId() || undefined,
      settings: {
        isPublic: this.editIsPublic(),
        isEditableByAll: this.editIsEditableByAll()
      }
    };

    this.saving.set(true);
    this.taskService.updateTask(t.id, payload as ITaskUpdateRO).subscribe({
      next: () => {
        this.task.update((cur) => (cur ? {...cur, ...payload} as TaskRO : null));
        this.saving.set(false);
        this.editing.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.editing.set(false);
      }
    });
  }

  deleteTask(): void {
    const t = this.task();
    if (!t) return;
    if (confirm('Удалить задачу?')) {
      this.deleting.set(true);
      this.taskService.deleteTask(t.id).subscribe({
        next: () => this.router.navigate(['/tasks'], {relativeTo: this.route}),
        error: () => this.deleting.set(false)
      });
    }
  }

  updateStatus(status: TaskStatus): void {
    const t = this.task();
    if (!t) return;
    const updated = {...t, taskStatus: status};
    this.task.set(updated);
    this.taskService.updateTaskStatus(t.id, status).subscribe({
      error: () => this.task.set(t)
    });
  }

  canDeactivate(): boolean {
    if (this.editing()) {
      return confirm('У вас есть несохраненные изменения. Уйти?');
    }
    return true;
  }

  createSubtask(): void {
    const currentTask = this.task();
    if (currentTask) {
      this.router.navigate(['/tasks', 'create'], {
        queryParams: { parentTaskId: currentTask.id }
      });
    }
  }

  toggleSubtasks(): void { this.subtasksExpanded.update((v) => !v); }
  openAssigneeModal(): void { this.showAssigneeModal.set(true); }
  closeAssigneeModal(): void { this.showAssigneeModal.set(false); }

  onAssigneesUpdated(): void {
    this.closeAssigneeModal();
    this.reloadTrigger.update((v) => v + 1);
  }

  reloadComments(): () => number {
    return () => this.reloadTrigger();
  }

  getPriorityColor = (p: TaskPriority): string => {
    switch (p) {
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      default: return 'priority-low';
    }
  };

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  isOverdue = (date: string | null | undefined): boolean => {
    if (!date) return false;
    const due = new Date(date);
    due.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return due < now;
  };

  formatTaskDate = (date: string | null | undefined): string => {
    if (!date) return '';
    return angularFormatDate(date, 'dd.MM.yyyy', 'en-US');
  };

  getPriorityLabel = (p: TaskPriority): string => p;
}
