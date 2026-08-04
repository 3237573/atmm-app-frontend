import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {CommonModule, formatDate as angularFormatDate} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslocoModule, TranslocoService} from '@ngneat/transloco';
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
import {finalize, Subscription} from 'rxjs';
import {AuthService} from '@core/services/auth.service';
import {ProjectAffiliation} from '@core/models/project.model';
import {MemberService} from '@core/services';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatInputModule} from '@angular/material/input';
import {MatFormFieldModule} from '@angular/material/form-field';
import {DateAdapter, provideNativeDateAdapter} from '@angular/material/core';
import {NavigationService} from '@core/services/navigation.service';

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
    AssigneeManager,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule
  ],
  providers: [
    provideNativeDateAdapter()
  ],
  templateUrl: './task-detail.html',
  styleUrls: ['./task-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskDetail implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly translocoService = inject(TranslocoService);
  private readonly dateAdapter = inject(DateAdapter<Date>);
  private readonly destroyRef = inject(DestroyRef);

  public router = inject(Router);
  public route = inject(ActivatedRoute);

  private readonly memberService = inject(MemberService);
  private readonly taskService = inject(TaskService);
  protected readonly navService = inject(NavigationService);

  currentUser = this.authService.currentUser;
  currentLang = signal<string>(this.translocoService.getActiveLang());

  // Сигналы настроек доступа
  editIsPublic = signal(false);
  editIsEditableByAll = signal(false);

  loading = signal(false);
  editing = signal(false);
  saving = signal(false);
  deleting = signal(false);
  showAssigneeModal = signal(false);
  subtasksExpanded = signal(true);

  task = signal<TaskRO | null>(null);
  taskTree = signal<TaskTreeRO | null>(null);
  availableParentTasks = signal<TaskRO[]>([]);
  userProjects = signal<ProjectAffiliation[]>([]);
  reloadTrigger = signal(0);

  editProjectId = signal<string>('');
  editTitle = signal('');
  editDescription = signal('');
  editDueDate = signal<Date | null>(null);
  minDate = new Date();
  editParentTaskId = signal<string | null>(null);
  editTaskStatus = signal<TaskStatus>('PENDING');
  editPriority = signal<TaskPriority>('LOW');

  // Убрали .required, так как редактор рендерится только при editing = true
  readonly taskEditor = viewChild<TaskEditorComponent>('editorRef');

  isCreator = computed(() => {
    const currentTask = this.task();
    const user = this.authService.currentUser();
    if (!currentTask || !user) return false;
    return currentTask.creatorId === user.id;
  });

  canEdit = computed(() => {
    const currentTask = this.task();
    const user = this.authService.currentUser();

    if (!currentTask || !user) return false;

    const isEditableByAll = currentTask.settings?.isEditableByAll === true;
    const isCreator = currentTask.creatorId === user.id;

    return isEditableByAll || isCreator;
  });

  selectedStatus = computed(() => this.task()?.taskStatus ?? 'PENDING');

  parentTaskTitleDisplay = computed(() => {
    const t = this.task();
    if (!t?.parentTaskId) return null;
    const p = this.availableParentTasks().find(x => x.id === t.parentTaskId);
    return p?.title ?? t.parentTaskTitle ?? null;
  });

  ngOnInit(): void {
    const sub = new Subscription();

    sub.add(
      this.translocoService.langChanges$.subscribe(lang => {
        this.dateAdapter.setLocale(lang === 'ru' ? 'ru-RU' : 'en-US');
        this.currentLang.set(lang);
      })
    );

    sub.add(
      this.route.paramMap.subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.loadTask(id);
        }
      })
    );

    this.destroyRef.onDestroy(() => sub.unsubscribe());
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
        this.editDueDate.set(data.dueDate ? new Date(data.dueDate) : null);
        this.editParentTaskId.set(data.parentTaskId ?? null);
        this.editTaskStatus.set(data.taskStatus);
        this.editPriority.set(data.priority);
        this.editIsPublic.set(data.settings?.isPublic ?? false);
        this.editIsEditableByAll.set(data.settings?.isEditableByAll ?? false);
        this.editProjectId.set(data.projectId ?? '');

        this.taskService.getTaskTree(id).subscribe({
          next: (tree) => this.taskTree.set(tree),
          error: (err) => console.error('Tree Loading Error:', err)
        });

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
      this.editDueDate.set(t.dueDate ? new Date(t.dueDate) : null);
      this.editParentTaskId.set(t.parentTaskId ?? null);
      this.editTaskStatus.set(t.taskStatus);
      this.editPriority.set(t.priority);
      this.editIsPublic.set(t.settings?.isPublic ?? false);
      this.editIsEditableByAll.set(t.settings?.isEditableByAll ?? false);
      this.taskEditor()?.setContent(t.description ?? '');
      this.editProjectId.set(t.projectId ?? '');
    }
    this.editing.set(false);
  }

  saveEdit(): void {
    const t = this.task();
    if (!t) return;

    const dueDateFormatted = this.editDueDate()
      ? this.toIsoDateString(this.editDueDate()!)
      : undefined;

    const payload: Partial<ITaskUpdateRO> = {
      title: this.editTitle(),
      description: this.taskEditor()?.getHTML() ?? this.editDescription(),
      status: this.editTaskStatus() || undefined,
      priority: this.editPriority() || undefined,
      dueDate: dueDateFormatted,
      parentTaskId: this.editParentTaskId(),
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

  private toIsoDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  getPriorityColor = (p: TaskPriority): string => {
    switch (p) {
      case 'HIGH': return 'priority-high';
      case 'MEDIUM': return 'priority-medium';
      default: return 'priority-low';
    }
  };

  formatDate = (dateStr: string | undefined): string => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';

    const locale = this.currentLang() === 'ru' ? 'ru-RU' : 'en-US';

    // Результат: "04 авг. 2026 г." для RU и "Aug 4, 2026" для EN
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  formatTaskDate = (date: string | null | undefined): string => {
    if (!date) return '';

    const locale = this.currentLang() === 'ru' ? 'ru-RU' : 'en-US';

    // Результат: "04.08.2026" для RU и "08/04/2026" для EN
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(new Date(date));
  };

  isOverdue = (date: string | null | undefined): boolean => {
    if (!date) return false;
    const due = new Date(date);
    due.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return due < now;
  };

  getPriorityLabel = (p: TaskPriority): string => p;
}
