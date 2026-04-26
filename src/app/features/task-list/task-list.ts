import {Component, OnInit, inject, signal, computed, effect} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TaskService } from '../../core/services/task/task.service';
import { ITaskRO, TaskStatus, TaskPriority } from '../../core/models/task.model';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss'
})
export class TaskList implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly storageKey = 'task_view_mode';

  tasks = signal<ITaskRO[]>([]);
  loading = signal(true);
  viewMode = signal<'list' | 'board'>('list');

  // Filters
  searchQuery = signal('');
  selectedStatus = signal<string>('');
  selectedPriority = signal<string>('');

  // Statistics
  stats = computed(() => {
    const tasks = this.tasks();
    const now = new Date();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'PENDING').length,
      inProgress: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      review: tasks.filter(t => t.status === 'REVIEW').length,
      completed: tasks.filter(t => t.status === 'COMPLETED').length,
      overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED').length
    };
  });

  // Computed for Kanban Columns
  pendingTasks = computed(() => this.tasks().filter(t => t.status === 'PENDING'));
  inProgressTasks = computed(() => this.tasks().filter(t => t.status === 'IN_PROGRESS'));
  reviewTasks = computed(() => this.tasks().filter(t => t.status === 'REVIEW'));
  completedTasks = computed(() => this.tasks().filter(t => t.status === 'COMPLETED'));

  ngOnInit(): void {
    const savedMode = localStorage.getItem(this.storageKey) as 'list' | 'board';
    if (savedMode && (savedMode === 'list' || savedMode === 'board')) {
      this.viewMode.set(savedMode);
    }
    this.loadTasks();
  }

  setViewMode(mode: 'list' | 'board'): void {
    this.viewMode.set(mode);
    localStorage.setItem(this.storageKey, mode);
  }

  // Вспомогательные методы для шаблона
  isOverdue(dueDate: string | undefined): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
  }

  getStatusLabel(status: TaskStatus): string {
    const labels = {
      'PENDING': 'Ожидает',
      'IN_PROGRESS': 'В работе',
      'REVIEW': 'На проверке',
      'COMPLETED': 'Выполнена',
      'ARCHIVED': 'Архив'
    };
    return labels[status];
  }

  getPriorityColor(priority: TaskPriority): string {
    const colors = {
      'LOW': 'priority-low',
      'MEDIUM': 'priority-medium',
      'HIGH': 'priority-high',
      'URGENT': 'priority-urgent'
    };
    return colors[priority];
  }

  loadTasks(): void {
    this.loading.set(true);
    this.taskService.getTasks().subscribe({
      next: (data) => {
        this.tasks.set(data || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки задач', err);
        this.tasks.set([]);
        this.loading.set(false);
      }
    });
  }

  filteredTasks(): ITaskRO[] {
    const tasks = this.tasks();
    if (!tasks.length) return [];

    return tasks.filter(task => {
      const matchesSearch = !this.searchQuery() ||
        task.title.toLowerCase().includes(this.searchQuery().toLowerCase()) ||
        task.assigneeName.toLowerCase().includes(this.searchQuery().toLowerCase());

      const matchesStatus = !this.selectedStatus() || task.status === this.selectedStatus();
      const matchesPriority = !this.selectedPriority() || task.priority === this.selectedPriority();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }

  updateStatus(task: ITaskRO, newStatus: string): void {
    this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
      next: () => this.loadTasks()
    });
  }
}
