import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TaskService } from '@core/services/task.service';
import { TaskRO, TaskTreeRO } from '@core/models/task/task.model';
import { AuthService } from '@core/services/auth.service';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';
import { ReplaceMePipe } from '@core/pipes/replace-me.pipe';

type RenderTask = TaskRO & {
  level: number;
  dateClass: 'overdue' | 'today' | 'soon' | 'future' | '';
  formattedDate: string;
};

interface TaskListState {
  viewMode: 'list' | 'board';
  searchQuery: string;
  selectedStatus: string;
  selectedPriority: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  expandedNodeIds: string[];
}

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackOnEscapeDirective, ReplaceMePipe],
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss'
})
export class TaskList implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly taskService = inject(TaskService);
  private readonly STORAGE_KEY = 'task_list_state';

  currentUser = this.authService.currentUser;
  taskTrees = signal<TaskTreeRO[]>([]);
  loading = signal(true);
  viewMode = signal<'list' | 'board'>('list');

  // Флаг, указывающий, что данные загрузились хотя бы один раз
  private tasksInitialLoaded = signal(false);

  // Фильтры
  searchQuery = signal('');
  selectedStatus = signal<string>('');
  selectedPriority = signal<string>('');
  expandedNodes = signal<Set<string>>(new Set());

  // Сортировка
  sortColumn = signal<string>('title');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Плоское дерево задач
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

  // Карта родителей для быстрого поиска вверх по дереву
  private readonly parentMap = computed(() => {
    const map = new Map<string, string | null>();
    for (const task of this.flatTasks()) {
      map.set(task.id, task.parentTaskId ?? null);
    }
    return map;
  });

  // Статистика
  stats = computed(() => {
    const tasks = this.flatTasks();
    const currentStats = { total: tasks.length, pending: 0, inProgress: 0, review: 0, completed: 0, overdue: 0, archived: 0 };
    const todayTime = new Date().setHours(0, 0, 0, 0);

    for (const t of tasks) {
      if (t.status === 'PENDING') currentStats.pending++;
      else if (t.status === 'IN_PROGRESS') currentStats.inProgress++;
      else if (t.status === 'REVIEW') currentStats.review++;
      else if (t.status === 'COMPLETED') currentStats.completed++;
      else if (t.status === 'ARCHIVED') currentStats.archived++;

      if (t.dueDate && t.status !== 'COMPLETED') {
        const dTime = new Date(t.dueDate).setHours(0, 0, 0, 0);
        if (dTime < todayTime) currentStats.overdue++;
      }
    }
    return currentStats;
  });

  // Фильтрация
  filteredTaskSets = computed(() => {
    const tasks = this.flatTasks();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatus();
    const priority = this.selectedPriority();

    const matchedIds = new Set<string>();
    const visibleIds = new Set<string>();
    const parentMap = this.parentMap();

    for (const task of tasks) {
      if (status && task.status !== status) continue;
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

    return { matchedIds, visibleIds, isFiltered: !!(query || status || priority) };
  });

  // Построение видимых задач для рендеринга
  visibleTasks = computed(() => {
    const { visibleIds } = this.filteredTaskSets();
    const expanded = this.expandedNodes();
    const result: RenderTask[] = [];
    const todayTime = new Date().setHours(0, 0, 0, 0);

    const parseDateInfo = (dateStr: string | undefined) => {
      if (!dateStr) return { dateClass: '' as const, formattedDate: '—' };
      const d = new Date(dateStr);
      const formattedDate = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const dateTime = d.setHours(0, 0, 0, 0);

      if (dateTime < todayTime) return { dateClass: 'overdue' as const, formattedDate };
      if (dateTime === todayTime) return { dateClass: 'today' as const, formattedDate };
      const diffDays = Math.ceil((dateTime - todayTime) / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 3) return { dateClass: 'soon' as const, formattedDate };
      return { dateClass: 'future' as const, formattedDate };
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
    const { matchedIds } = this.filteredTaskSets();
    return this.flatTasks().filter(t => matchedIds.has(t.id));
  });

  constructor() {
    // 1. Сначала восстанавливаем состояние из хранилища
    this.restoreState();

    // ЭФФЕКТ 1: Автоматическое раскрытие веток при поиске/фильтрации
    effect(() => {
      const { visibleIds, isFiltered } = this.filteredTaskSets();

      untracked(() => {
        // Если фильтр пустой или данные еще не загружены, ничего автоматически не раскрываем
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
    }, { allowSignalWrites: true });

    // ЭФФЕКТ 2: Сохранение состояния в LocalStorage при любых изменениях
    effect(() => {
      // Защита: не перезаписываем сохраненную структуру пустой, пока не сработал первый loadTasks
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

    // ЭФФЕКТ 3: Очистка старых/удаленных ID задач из списка раскрытых веток
    effect(() => {
      const tasks = this.flatTasks();
      const isLoaded = this.tasksInitialLoaded();

      untracked(() => {
        // Начинаем валидацию сохраненных веток ТОЛЬКО после того, как получили актуальное дерево от API
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
    }, { allowSignalWrites: true });
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
      this.selectedStatus.set(state.selectedStatus ?? '');
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
        // Сигнализируем, что первая успешная загрузка завершена
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

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'PENDING': 'status-pending',
      'IN_PROGRESS': 'status-progress',
      'REVIEW': 'status-review',
      'COMPLETED': 'status-completed',
      'ARCHIVED': 'status-archived'
    };
    return classes[status] || '';
  }

  getPriorityColor(priority: string): string {
    return priority ? priority.toLowerCase() : 'low';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'Ожидает',
      'IN_PROGRESS': 'В работе',
      'REVIEW': 'Проверка',
      'COMPLETED': 'Готово',
      'ARCHIVED': 'Архив'
    };
    return labels[status] || status;
  }

  updateStatus(task: TaskRO, newStatus: string): void {
    this.taskService.updateTaskStatus(task.id, newStatus).subscribe(() => this.loadTasks());
  }

  setViewMode(mode: 'list' | 'board') {
    this.viewMode.set(mode);
  }
}
