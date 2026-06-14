import {Component, computed, effect, inject, OnInit, signal, untracked} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {TaskService} from '@core/services/task.service';
import {TASK_STATUS_CONFIG, TASK_STATUS_LIST, TaskPriority, TaskRO, TaskStatus, TaskTreeRO} from '@core/models/task/task.model';
import {AuthService} from '@core/services/auth.service';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {ReplaceMePipe} from '@core/pipes/replace-me.pipe';
import {TranslocoPipe, TranslocoService} from '@ngneat/transloco'; // <-- Добавили импорты

type RenderTask = TaskRO & {
  level: number;
  dateClass: 'overdue' | 'today' | 'soon' | 'future' | '';
  formattedDate: string;
};

interface TaskListState {
  viewMode: 'list' | 'board';
  searchQuery: string;
  selectedStatus: TaskStatus | '';
  selectedPriority: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  expandedNodeIds: string[];
}

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackOnEscapeDirective, ReplaceMePipe, TranslocoPipe], // <-- Добавили TranslocoPipe
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss'
})
export class TaskList implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly taskService = inject(TaskService);
  private readonly translocoService = inject(TranslocoService); // <-- Внедряем сервис для работы с языком
  private readonly STORAGE_KEY = 'task_list_state';
  protected readonly TASK_STATUS_LIST = TASK_STATUS_LIST;

  currentUser = this.authService.currentUser;
  taskTrees = signal<TaskTreeRO[]>([]);
  loading = signal(true);
  viewMode = signal<'list' | 'board'>('list');

  private readonly tasksInitialLoaded = signal(false);

  searchQuery = signal('');
  selectedStatus = signal<TaskStatus | ''>('');
  selectedPriority = signal<string>('');
  expandedNodes = signal<Set<string>>(new Set());

  sortColumn = signal<string>('title');
  sortDirection = signal<'asc' | 'desc'>('asc');

  flatTasks = computed(() => {
    const tasks: TaskRO[] = [];
    const traverse = (trees: TaskTreeRO[]) => {
      for (const tree of trees) {
        tasks.push(tree.task);
        if (tree.subtasks?.length) traverse(tree.subtasks);
      }
    };
    traverse(this.taskTrees());
    return tasks;
  });

  private readonly parentMap = computed(() => {
    const map = new Map<string, string | null>();
    for (const task of this.flatTasks()) {
      map.set(task.id, task.parentTaskId ?? null);
    }
    return map;
  });

  stats = computed(() => {
    const tasks = this.flatTasks();
    const currentStats = {total: tasks.length, pending: 0, inProgress: 0, review: 0, completed: 0, overdue: 0, archived: 0};
    const todayTime = new Date().setHours(0, 0, 0, 0);

    for (const t of tasks) {
      if (t.taskStatus === 'PENDING') currentStats.pending++;
      else if (t.taskStatus === 'IN_PROGRESS') currentStats.inProgress++;
      else if (t.taskStatus === 'REVIEW') currentStats.review++;
      else if (t.taskStatus === 'COMPLETED') currentStats.completed++;
      else if (t.taskStatus === 'ARCHIVED') currentStats.archived++;

      if (t.dueDate && t.taskStatus !== 'COMPLETED') {
        const dTime = new Date(t.dueDate).setHours(0, 0, 0, 0);
        if (dTime < todayTime) currentStats.overdue++;
      }
    }
    return currentStats;
  });

  filteredTaskSets = computed(() => {
    const tasks = this.flatTasks();
    const query = this.searchQuery().trim().toLowerCase();
    const taskStatus = this.selectedStatus();
    const priority = this.selectedPriority();

    const matchedIds = new Set<string>();
    const visibleIds = new Set<string>();
    const parentMap = this.parentMap();

    for (const task of tasks) {
      if (taskStatus && task.taskStatus !== taskStatus) continue;
      if (priority && task.priority !== priority) continue;
      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch) continue;
      }
      matchedIds.add(task.id);
    }

    for (const id of matchedIds) {
      let current: string | null = id;
      while (current) {
        visibleIds.add(current);
        current = parentMap.get(current) ?? null;
      }
    }

    return {matchedIds, visibleIds, isFiltered: !!(query || taskStatus || priority)};
  });

  visibleTasks = computed(() => {
    const {visibleIds} = this.filteredTaskSets();
    const expanded = this.expandedNodes();
    const result: RenderTask[] = [];
    const todayTime = new Date().setHours(0, 0, 0, 0);

    const parseDateInfo = (dateStr: string | undefined) => {
      if (!dateStr) return {dateClass: '' as const, formattedDate: '—'};
      const d = new Date(dateStr);
      // Используем текущий язык приложения из Transloco вместо хардкода 'ru-RU'
      const formattedDate = d.toLocaleDateString(this.translocoService.getActiveLang(), {day: '2-digit', month: '2-digit', year: 'numeric'});
      const dateTime = d.setHours(0, 0, 0, 0);

      if (dateTime < todayTime) return {dateClass: 'overdue' as const, formattedDate};
      if (dateTime === todayTime) return {dateClass: 'today' as const, formattedDate};
      const diffDays = Math.ceil((dateTime - todayTime) / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 3) return {dateClass: 'soon' as const, formattedDate};
      return {dateClass: 'future' as const, formattedDate};
    };

    const traverse = (trees: TaskTreeRO[], level: number) => {
      for (const node of trees) {
        const task = node.task;
        if (!visibleIds.has(task.id)) continue;

        const dateInfo = parseDateInfo(task.dueDate);
        result.push({
          ...task,
          level,
          dateClass: dateInfo.dateClass,
          formattedDate: dateInfo.formattedDate
        });

        if (expanded.has(task.id) && node.subtasks?.length) {
          traverse(node.subtasks, level + 1);
        }
      }
    };

    traverse(this.taskTrees(), 0);
    return this.sortHierarchy(result);
  });

  filteredFlatTasks = computed(() => {
    const {matchedIds} = this.filteredTaskSets();
    return this.flatTasks().filter(t => matchedIds.has(t.id));
  });

  constructor() {
    this.restoreState();

    effect(() => {
      const {visibleIds, isFiltered} = this.filteredTaskSets();

      untracked(() => {
        if (!isFiltered || !this.tasksInitialLoaded()) return;

        const currentExpanded = new Set(this.expandedNodes());
        let changed = false;

        visibleIds.forEach(id => {
          if (!currentExpanded.has(id)) {
            currentExpanded.add(id);
            changed = true;
          }
        });

        if (changed) this.expandedNodes.set(currentExpanded);
      });
    }, {allowSignalWrites: true});

    effect(() => {
      if (!this.tasksInitialLoaded()) return;

      const state: TaskListState = {
        viewMode: this.viewMode(),
        searchQuery: this.searchQuery(),
        selectedStatus: this.selectedStatus(),
        selectedPriority: this.selectedPriority(),
        sortColumn: this.sortColumn(),
        sortDirection: this.sortDirection(),
        expandedNodeIds: Array.from(this.expandedNodes()),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    });

    effect(() => {
      const tasks = this.flatTasks();
      const isLoaded = this.tasksInitialLoaded();

      untracked(() => {
        if (!isLoaded) return;

        const currentIds = new Set(tasks.map(t => t.id));
        const expanded = new Set(this.expandedNodes());
        let needUpdate = false;

        for (const id of expanded) {
          if (!currentIds.has(id)) {
            expanded.delete(id);
            needUpdate = true;
          }
        }
        if (needUpdate) this.expandedNodes.set(expanded);
      });
    }, {allowSignalWrites: true});
  }

  ngOnInit() {
    this.loadTasks();
  }

  private restoreState(): void {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return;
    try {
      const state = JSON.parse(raw) as TaskListState;
      this.viewMode.set(state.viewMode ?? 'list');
      this.searchQuery.set(state.searchQuery ?? '');

      const savedStatus = state.selectedStatus;
      const validStatus = savedStatus && TASK_STATUS_LIST.includes(savedStatus as TaskStatus)
        ? savedStatus as TaskStatus
        : '';
      this.selectedStatus.set(validStatus);

      this.selectedPriority.set(state.selectedPriority ?? '');
      this.sortColumn.set(state.sortColumn ?? 'title');
      this.sortDirection.set(state.sortDirection ?? 'asc');
      if (state.expandedNodeIds?.length) {
        this.expandedNodes.set(new Set(state.expandedNodeIds));
      }
    } catch (e) {
      console.warn('Ошибка восстановления состояния', e);
    }
  }

  loadTasks() {
    this.loading.set(true);
    this.taskService.getMyTaskTree().subscribe({
      next: (data) => {
        this.taskTrees.set(data || []);
        this.loading.set(false);
        this.tasksInitialLoaded.set(true);
      },
      error: (err) => {
        console.error('Ошибка загрузки задач', err);
        this.loading.set(false);
      }
    });
  }

  private sortHierarchy(tasks: RenderTask[]): RenderTask[] {
    const childrenMap = new Map<string | null, RenderTask[]>();
    for (const task of tasks) {
      const parentId = task.parentTaskId ?? null;
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId)!.push(task);
    }

    const col = this.sortColumn();
    const dir = this.sortDirection();
    const modifier = dir === 'asc' ? 1 : -1;

    const compare = (a: RenderTask, b: RenderTask): number => {
      let aVal: any = a.title, bVal: any = b.title;

      switch (col) {
        case 'dueDate':
          aVal = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bVal = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        case 'status':
        case 'priority':
          aVal = a[col];
          bVal = b[col];
          break;
        case 'departmentName':
        case 'projectName':
        case 'creatorName':
          aVal = (a[col as keyof RenderTask] as string || '').toLowerCase();
          bVal = (b[col as keyof RenderTask] as string || '').toLowerCase();
          break;
        case 'assigneeNames':
          aVal = (a.assigneeNames?.[0] || '').toLowerCase();
          bVal = (b.assigneeNames?.[0] || '').toLowerCase();
          break;
        default:
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
      }
      if (aVal < bVal) return -1 * modifier;
      if (aVal > bVal) return 1 * modifier;
      return 0;
    };

    const sortAndFlatten = (parentId: string | null): RenderTask[] => {
      const children = childrenMap.get(parentId) || [];
      const sorted = children.sort(compare);
      const out: RenderTask[] = [];
      for (const child of sorted) {
        out.push(child);
        out.push(...sortAndFlatten(child.id));
      }
      return out;
    };

    return sortAndFlatten(null);
  }

  sortBy(column: string): void {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(column: string): string {
    if (this.sortColumn() !== column) return 'unfold_more';
    return this.sortDirection() === 'asc' ? 'expand_less' : 'expand_more';
  }

  toggleNode(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const newSet = new Set(this.expandedNodes());
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    this.expandedNodes.set(newSet);
  }

  getPriorityColor(priority: TaskPriority | string): string {
    if (!priority) return 'priority-low';
    return 'priority-' + priority.toLowerCase();
  }

  getStatusClass(status: TaskStatus): string {
    return TASK_STATUS_CONFIG[status]?.class || '';
  }

  getFilterStatusClass(status: TaskStatus | ''): string {
    if (!status) return '';
    return TASK_STATUS_CONFIG[status]?.class || '';
  }

  updateStatus(task: TaskRO, newStatus: string): void {
    const status = newStatus as TaskStatus;
    const updateTaskInTree = (trees: TaskTreeRO[]): boolean => {
      for (const tree of trees) {
        if (tree.task.id === task.id) {
          tree.task.taskStatus = status;
          return true;
        }
        if (tree.subtasks?.length && updateTaskInTree(tree.subtasks)) return true;
      }
      return false;
    };
    updateTaskInTree(this.taskTrees());
    this.taskTrees.set([...this.taskTrees()]);

    this.taskService.updateTaskStatus(task.id, status).subscribe({
      error: (err) => {
        console.error('Ошибка обновления', err);
        this.loadTasks();
      }
    });
  }

  setViewMode(mode: 'list' | 'board') {
    this.viewMode.set(mode);
  }
}
