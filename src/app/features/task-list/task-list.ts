import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TaskService } from '../../core/services/task.service';
import { TaskRO, TaskTreeRO } from '../../core/models/task/task.model';
import { AuthService } from '../../core/services/auth.service';
import { BackOnEscapeDirective } from '../../core/directives/back-on-escape.directive';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackOnEscapeDirective],
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

  // 1. Чистый плоский список (базовый слой без фильтрации для статистики и карт связей)
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

  // 2. Оптимальный расчет статистики за один проход O(N)
  stats = computed(() => {
    const tasks = this.flatTasks();
    const currentStats = { total: tasks.length, pending: 0, inProgress: 0, review: 0, completed: 0, overdue: 0 };

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayTime = todayMidnight.getTime();

    for (const t of tasks) {
      if (t.status === 'PENDING') currentStats.pending++;
      else if (t.status === 'IN_PROGRESS') currentStats.inProgress++;
      else if (t.status === 'REVIEW') currentStats.review++;
      else if (t.status === 'COMPLETED') currentStats.completed++;

      if (t.dueDate && t.status !== 'COMPLETED') {
        const d = new Date(t.dueDate);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() < todayTime) currentStats.overdue++;
      }
    }
    return currentStats;
  });

  // 3. Фильтрация ID (поиск по названию И по описанию задачи)
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
        // Защита от null/undefined в описании задачи
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

  // 4. Логика автоматического раскрытия веток при поиске и схлопывания при заходе
  private updateExpandedFromFilter() {
    const query = this.searchQuery().trim();
    const status = this.selectedStatus();
    const priority = this.selectedPriority();

    // Задачи изначально СВЁРНУТЫ при первом заходе или сбросе строки поиска
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
        const parent: any = parentMap.get(current) ?? null;
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

  // 5. Построение видимого дерева. Расчет дат перенесен сюда (HTML теперь не тормозит)
  visibleTasks = computed(() => {
    const filteredIds = this.filteredTaskIds();
    const expanded = this.expandedNodes();

    type RenderTask = TaskRO & {
      level: number;
      dateClass: 'overdue' | 'today' | 'soon' | 'future' | '';
      formattedDate: string;
    };
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
    return result;
  });

  // Отфильтрованные плоские задачи для Канбан-доски
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

  formatAssigneeName(assigneeName: string | string[]): string {
    if (!assigneeName) return 'Не назначен';
    let assigneeString = Array.isArray(assigneeName) ? assigneeName.join(', ') : String(assigneeName);

    const user = this.currentUser();
    if (!user) return assigneeString;

    const currentUserName = user.displayName || user.fullName || user.email?.split('@')[0] || '';
    return assigneeString.split(',').map(a => {
      const name = a.trim();
      return name === currentUserName ? 'Я' : name;
    }).join(', ');
  }

  // ТВОИ ОРИГИНАЛЬНЫЕ КЛАССЫ СТАТУСОВ (Без изменений)
  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'PENDING': 'status-pending',
      'IN_PROGRESS': 'status-progress',
      'REVIEW': 'status-review',
      'COMPLETED': 'status-completed'
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
      'COMPLETED': 'Готово'
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
