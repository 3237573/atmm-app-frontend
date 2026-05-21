import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { TaskRO, TaskTreeRO } from '../../core/models/task/task.model';
import { AuthService } from '../../core/services/auth.service';
import { BackOnEscapeDirective } from '../../core/directives/back-on-escape.directive';
import { ReplaceMePipe } from '../../core/pipes/replace-me.pipe';

type RenderTask = TaskRO & {
  level: number;
  dateClass: 'overdue' | 'today' | 'soon' | 'future' | '';
  formattedDate: string;
};

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

  currentUser = this.authService.currentUser;
  taskTrees = signal<TaskTreeRO[]>([]);
  loading = signal(true);
  viewMode = signal<'list' | 'board'>('list');
  searchQuery = signal('');
  selectedStatus = signal<string>('');
  selectedPriority = signal<string>('');
  expandedNodes = signal<Set<string>>(new Set());

  // Сортировка
  sortColumn = signal<string>('title');
  sortDirection = signal<'asc' | 'desc'>('asc');

  flatTasks = computed(() => {
    const flatten = (trees: TaskTreeRO[]): TaskRO[] => {
      let tasks: TaskRO[] = [];
      for (const tree of trees) {
        tasks.push(tree.task);
        if (tree.subtasks?.length) tasks.push(...flatten(tree.subtasks));
      }
      return tasks;
    };
    return flatten(this.taskTrees());
  });

  stats = computed(() => {
    const tasks = this.flatTasks();
    const currentStats = { total: tasks.length, pending: 0, inProgress: 0, review: 0, completed: 0, overdue: 0, archived: 0 };
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayTime = todayMidnight.getTime();

    for (const t of tasks) {
      if (t.status === 'PENDING') currentStats.pending++;
      else if (t.status === 'IN_PROGRESS') currentStats.inProgress++;
      else if (t.status === 'REVIEW') currentStats.review++;
      else if (t.status === 'COMPLETED') currentStats.completed++;
      else if (t.status === 'ARCHIVED') currentStats.archived++;

      if (t.dueDate && t.status !== 'COMPLETED') {
        const d = new Date(t.dueDate);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() < todayTime) currentStats.overdue++;
      }
    }
    return currentStats;
  });

  filteredTaskIds = computed(() => {
    const tasks = this.flatTasks();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatus();
    const priority = this.selectedPriority();
    const ids = new Set<string>();

    for (const task of tasks) {
      if (status && task.status !== status) continue;
      if (priority && task.priority !== priority) continue;
      if (query) {
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch) continue;
      }
      ids.add(task.id);
    }
    return ids;
  });

  private parentMap = computed(() => {
    const map = new Map<string, string | null>();
    for (const task of this.flatTasks()) {
      map.set(task.id, task.parentTaskId ?? null);
    }
    return map;
  });

  private updateExpandedFromFilter() {
    const query = this.searchQuery().trim();
    const status = this.selectedStatus();
    const priority = this.selectedPriority();
    if (!query && !status && !priority) {
      this.expandedNodes.set(new Set());
      return;
    }
    const filteredIds = this.filteredTaskIds();
    if (filteredIds.size === 0) {
      this.expandedNodes.set(new Set());
      return;
    }
    const ancestors = new Set<string>();
    const parentMap = this.parentMap();
    for (const id of filteredIds) {
      let current: string | null = id;
      while (current) {
        const parent: string | null | undefined = parentMap.get(current) ?? null;
        if (parent) ancestors.add(parent);
        current = parent;
      }
    }
    this.expandedNodes.set(ancestors);
  }

  private readonly filterSignal = computed(() => ({
    query: this.searchQuery(),
    status: this.selectedStatus(),
    priority: this.selectedPriority(),
  }));

  constructor() {
    effect(() => {
      this.filterSignal();
      this.updateExpandedFromFilter();
    });
  }

  // Построение видимого дерева
  visibleTasks = computed(() => {
    const filteredIds = this.filteredTaskIds();
    const expanded = this.expandedNodes();
    const result: RenderTask[] = [];

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayTime = todayMidnight.getTime();

    const parseDateInfo = (dateStr: string | undefined) => {
      if (!dateStr) return { dateClass: '' as const, formattedDate: '—' };
      const d = new Date(dateStr);
      const formattedDate = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
      d.setHours(0, 0, 0, 0);
      const dateTime = d.getTime();
      if (dateTime < todayTime) return { dateClass: 'overdue' as const, formattedDate };
      if (dateTime === todayTime) return { dateClass: 'today' as const, formattedDate };
      const diffDays = Math.ceil((dateTime - todayTime) / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && diffDays <= 3) return { dateClass: 'soon' as const, formattedDate };
      return { dateClass: 'future' as const, formattedDate };
    };

    const hasMatchingDescendant = (node: TaskTreeRO): boolean => {
      if (!node.subtasks?.length) return false;
      for (const child of node.subtasks) {
        if (filteredIds.has(child.task.id)) return true;
        if (hasMatchingDescendant(child)) return true;
      }
      return false;
    };

    const traverse = (trees: TaskTreeRO[], level: number) => {
      for (const node of trees) {
        const task = node.task;
        const matches = filteredIds.has(task.id);
        const hasDescendantMatch = hasMatchingDescendant(node);
        if (!matches && !hasDescendantMatch) continue;

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

  /**
   * Рекурсивная сортировка, сохраняющая иерархию
   */
  private sortHierarchy(tasks: RenderTask[]): RenderTask[] {
    const childrenMap = new Map<string | null, RenderTask[]>();
    for (const task of tasks) {
      const parentId = task.parentTaskId ?? null;
      if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
      childrenMap.get(parentId)!.push(task);
    }

    const compare = (a: RenderTask, b: RenderTask): number => {
      let aVal: any, bVal: any;
      const col = this.sortColumn();
      const dir = this.sortDirection();
      switch (col) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'departmentName':
          aVal = (a.departmentName || '').toLowerCase();
          bVal = (b.departmentName || '').toLowerCase();
          break;
        case 'projectName':
          aVal = (a.projectName || '').toLowerCase();
          bVal = (b.projectName || '').toLowerCase();
          break;
        case 'creatorName':
          aVal = (a.creatorName || '').toLowerCase();
          bVal = (b.creatorName || '').toLowerCase();
          break;
        case 'assigneeNames':
          aVal = (a.assigneeNames?.[0] || '').toLowerCase();
          bVal = (b.assigneeNames?.[0] || '').toLowerCase();
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'priority':
          aVal = a.priority;
          bVal = b.priority;
          break;
        case 'dueDate':
          aVal = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          bVal = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          break;
        default:
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
      }
      if (aVal < bVal) return dir === 'asc' ? -1 : 1;
      if (aVal > bVal) return dir === 'asc' ? 1 : -1;
      return 0;
    };

    const sortAndFlatten = (parentId: string | null): RenderTask[] => {
      const children = childrenMap.get(parentId) || [];
      const sorted = [...children].sort(compare);
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

  filteredFlatTasks = computed(() => {
    const tasks = this.flatTasks();
    const filteredIds = this.filteredTaskIds();
    return tasks.filter(t => filteredIds.has(t.id));
  });

  ngOnInit() {
    const savedViewMode = localStorage.getItem('task_view_mode');
    if (savedViewMode === 'list' || savedViewMode === 'board') {
      this.viewMode.set(savedViewMode);
    }
    this.loadTasks();
  }

  loadTasks() {
    this.loading.set(true);
    this.taskService.getMyTaskTree().subscribe({
      next: (data) => {
        this.taskTrees.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки задач', err);
        this.loading.set(false);
      }
    });
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
    localStorage.setItem('task_view_mode', mode);
  }
}
