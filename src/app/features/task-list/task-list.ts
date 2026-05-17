// task-list.ts
import {Component, computed, effect, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {RouterModule} from '@angular/router';
import {TaskService} from '../../core/services/task.service';
import {TaskRO, TaskTreeRO} from '../../core/models/task/task.model';
import {AuthService} from '../../core/services/auth.service';
import {BackOnEscapeDirective} from '../../core/directives/back-on-escape.directive';

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

  // Все задачи плоским списком
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

  // Статистика (без учёта фильтров)
  stats = computed(() => {
    const tasks = this.flatTasks();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'PENDING').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      review: tasks.filter(t => t.status === 'REVIEW').length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED').length
    };
  });

  // ID задач, прошедших фильтрацию
  filteredTaskIds = computed(() => {
    const tasks = this.flatTasks();
    const query = this.searchQuery().toLowerCase();
    const status = this.selectedStatus();
    const priority = this.selectedPriority();
    return new Set(
      tasks
        .filter(task => {
          const matchSearch = !query || task.title.toLowerCase().includes(query);
          const matchStatus = !status || task.status === status;
          const matchPriority = !priority || task.priority === priority;
          return matchSearch && matchStatus && matchPriority;
        })
        .map(t => t.id)
    );
  });

  // Карта родительских связей
  private parentMap = computed(() => {
    const map = new Map<string, string | null>();
    for (const task of this.flatTasks()) {
      map.set(task.id, task.parentTaskId ?? null);
    }
    return map;
  });

  // Автоматическое разворачивание предков при фильтрации
  // task-list.ts (исправленный фрагмент)
  private updateExpandedFromFilter() {
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
        const parent: any = parentMap.get(current) ?? null; // преобразуем undefined в null
        if (parent) ancestors.add(parent);
        current = parent;
      }
    }
    this.expandedNodes.set(ancestors);
  }

  // Отслеживаем изменения фильтров
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

  // Видимые задачи с уровнем вложенности для отрисовки
  visibleTasks = computed(() => {
    const filteredIds = this.filteredTaskIds();
    const expanded = this.expandedNodes();
    const result: (TaskRO & { level: number })[] = [];

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

        result.push({ ...task, level });

        if (expanded.has(task.id) && node.subtasks?.length) {
          traverse(node.subtasks, level + 1);
        }
      }
    };

    traverse(this.taskTrees(), 0);
    return result;
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
    let assigneeString: string;
    if (Array.isArray(assigneeName)) {
      assigneeString = assigneeName.join(', ');
    } else if (typeof assigneeName !== 'string') {
      assigneeString = String(assigneeName);
    } else {
      assigneeString = assigneeName;
    }
    const user = this.currentUser();
    if (!user) return assigneeString;
    const currentUserName = user.displayName || user.fullName || user.email?.split('@')[0] || '';
    const assignees = assigneeString.split(',').map(a => a.trim());
    const formattedAssignees = assignees.map(name => name === currentUserName ? 'Я' : name);
    return formattedAssignees.join(', ');
  }

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
    return `priority-${priority.toLowerCase()}`;
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

  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

  isToday(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  }

  isSoon(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 && diffDays <= 3;
  }

  isFuture(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
  }

  formatDate(date: string): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  setViewMode(mode: 'list' | 'board') {
    this.viewMode.set(mode);
    localStorage.setItem('task_view_mode', mode);
  }
}
