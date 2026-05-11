import {Component, computed, HostListener, inject, OnInit, signal} from '@angular/core';
import {CommonModule, Location} from '@angular/common';
import { FormsModule } from '@angular/forms';
import {Router, RouterModule} from '@angular/router';
import { TaskService } from '../../core/services/task/task.service';
import { TaskTreeRO, TaskRO } from '../../core/models/task/task.model';
import { AuthService } from '../../core/services/auth/auth.service';
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

  // Храним деревья задач
  taskTrees = signal<TaskTreeRO[]>([]);
  loading = signal(true);
  viewMode = signal<'list' | 'board'>('list');

  searchQuery = signal('');
  selectedStatus = signal<string>('');
  selectedPriority = signal<string>('');

  // Преобразуем деревья в плоский список для статистики и фильтрации
  flatTasks = computed(() => {
    const flatten = (trees: TaskTreeRO[]): TaskRO[] => {
      let tasks: TaskRO[] = [];
      for (const tree of trees) {
        tasks.push(tree.task);
        if (tree.subtasks?.length) {
          tasks.push(...flatten(tree.subtasks));
        }
      }
      return tasks;
    };
    return flatten(this.taskTrees());
  });

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

  // Фильтрованные задачи (плоский список для отображения)
  filteredTasks = computed(() => {
    return this.flatTasks().filter(task => {
      const matchesSearch = !this.searchQuery() ||
        task.title.toLowerCase().includes(this.searchQuery().toLowerCase());
      const matchesStatus = !this.selectedStatus() || task.status === this.selectedStatus();
      const matchesPriority = !this.selectedPriority() || task.priority === this.selectedPriority();
      return matchesSearch && matchesStatus && matchesPriority;
    });
  });

  ngOnInit(): void {
    const savedViewMode = localStorage.getItem('task_view_mode');
    if (savedViewMode === 'list' || savedViewMode === 'board') {
      this.viewMode.set(savedViewMode);
    }
    this.loadTasks();
  }

  loadTasks(): void {
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

  // Обновим существующий isOverdue для корректного сравнения дат
  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    // Сравниваем только дату, отбросив время
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return date < today;
  }

// Является ли дата сегодняшним днём
  isToday(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return date.getTime() === today.getTime();
  }

// Ближайшие 3 дня (не включая сегодня)
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
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  setViewMode(mode: 'list' | 'board') {
    this.viewMode.set(mode);
    localStorage.setItem('task_view_mode', mode);
  }

  // Для отображения уровня вложенности в списке
  getIndentLevel(task: TaskRO, tasks: TaskRO[]): number {
    let level = 0;
    let currentId = task.parentTaskId;
    while (currentId) {
      const parent = tasks.find(t => t.id === currentId);
      if (!parent) break;
      level++;
      currentId = parent.parentTaskId;
    }
    return level;
  }

}
