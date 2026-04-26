import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TaskService } from '../../../core/services/task/task.service';
import { ITaskRO, TaskPriority, TaskStatus } from '../../../core/models/task.model';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './task-detail.html',
  styleUrl: './task-detail.scss'
})
export class TaskDetail implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  task = signal<ITaskRO | null>(null);
  loading = signal(true);
  editing = signal(false);
  saving = signal(false);
  deleting = signal(false);

  minDate: string = new Date().toISOString().split('T')[0];
  editData = {
    title: '',
    description: '',
    priority: '' as TaskPriority,
    status: '' as TaskStatus,
    dueDate: ''
  };

  isOverdue(dueDate: string | undefined): boolean {
    if (!dueDate) return false;
    const task = this.task();
    return new Date(dueDate) < new Date() && task?.status !== 'COMPLETED';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTask(id);
    }
  }

  loadTask(id: string): void {
    this.loading.set(true);
    this.taskService.getTaskById(id).subscribe({
      next: (data) => {
        this.task.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки задачи', err);
        this.loading.set(false);
        this.router.navigate(['/tasks']);
      }
    });
  }

  startEdit(): void {
    const task = this.task();
    if (task) {

      // Convert the date from ISO format to YYYY-MM-DD for input type="date"
      let formattedDueDate = '';
      if (task.dueDate) {
        // task.dueDate arrives in the format "2026-05-01T00:00:00Z" or "2026-05-01"
        formattedDueDate = task.dueDate.split('T')[0]; // We take only YYYY-MM-DD
      }

      this.editData = {
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status,
        dueDate: formattedDueDate
      };
      this.editing.set(true);
    }
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  saveEdit(): void {
    const task = this.task();
    if (!task) return;

    this.saving.set(true);
    this.taskService.updateTask(task.id, {
      title: this.editData.title,
      description: this.editData.description,
      priority: this.editData.priority,
      status: this.editData.status,
      dueDate: this.editData.dueDate || undefined
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.loadTask(task.id);
      },
      error: (err) => {
        console.error('Ошибка сохранения', err);
        this.saving.set(false);
        alert('Ошибка сохранения задачи');
      }
    });
  }

  deleteTask(): void {
    const task = this.task();
    if (!task) return;

    if (confirm(`Удалить задачу "${task.title}"?`)) {
      this.deleting.set(true);
      this.taskService.deleteTask(task.id).subscribe({
        next: () => {
          this.deleting.set(false);
          this.router.navigate(['/tasks']);
        },
        error: (err) => {
          console.error('Ошибка удаления', err);
          this.deleting.set(false);
          alert('Ошибка удаления задачи');
        }
      });
    }
  }

  updateStatus(newStatus: string): void {
    const task = this.task();
    if (task) {
      this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
        next: () => this.loadTask(task.id),
        error: (err) => console.error('Ошибка обновления статуса', err)
      });
    }
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

  getPriorityLabel(priority: TaskPriority): string {
    const labels = {
      'LOW': 'Низкий',
      'MEDIUM': 'Средний',
      'HIGH': 'Высокий',
      'URGENT': 'Срочный'
    };
    return labels[priority];
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

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  goBack(): void {
    this.router.navigate(['/tasks']);
  }
}
