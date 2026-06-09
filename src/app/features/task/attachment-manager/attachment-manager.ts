import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '@core/services/task.service';
import { TaskAttachmentRO } from '@core/models/task/task.model';
import {HasPermissionDirective} from '@core/directives/has-permission.directive';

@Component({
  selector: 'app-task-attachment-manager',
  standalone: true,
  imports: [CommonModule, HasPermissionDirective],
  templateUrl: './attachment-manager.html',
  styleUrls: ['./attachment-manager.scss']
})
export class AttachmentManager implements OnInit {
  @Input({ required: true }) taskId!: string;
  @Input() initialAttachments: TaskAttachmentRO[] = [];

  private readonly taskService = inject(TaskService);

  // Реактивное состояние вложений и статусов
  attachments = signal<TaskAttachmentRO[]>([]);
  isDragging = signal(false);
  isUploading = signal(false);

  ngOnInit(): void {
    if (this.initialAttachments) {
      this.attachments.set(this.initialAttachments);
    }
  }

  // Выбор через клик на скрепку/кнопку
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.validateAndUploadFile(input.files[0]);
    }
  }

  // Хэндлеры для Drag & Drop
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.attachments().length < 3) {
      this.isDragging.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.validateAndUploadFile(event.dataTransfer.files[0]);
    }
  }

  // Единый метод валидации и загрузки файла
  private validateAndUploadFile(file: File): void {
    // 1. Проверка лимита на количество (макс. 3)
    if (this.attachments().length >= 3) {
      alert('Превышен лимит: можно прикрепить не более 3-х файлов к одной задаче.');
      return;
    }

    // 2. Проверка лимита на размер (макс. 1 МБ)
    const maxSizeBytes = 1024 * 1024; // 1 MB
    if (file.size > maxSizeBytes) {
      alert(`Файл "${file.name}" слишком большой (${this.formatFileSize(file.size)}). Максимальный размер — 1 МБ.`);
      return;
    }

    // Проверки пройдены — отправляем на бэкенд
    this.isUploading.set(true);
    this.taskService.uploadAttachment(this.taskId, file).subscribe({
      next: (newAttachment) => {
        this.attachments.update(current => [...current, newAttachment]);
        this.isUploading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки файла:', err);
        alert('Не удалось загрузить файл на сервер.');
        this.isUploading.set(false);
      }
    });
  }

  deleteAttachment(id: string, event: MouseEvent): void {
    event.stopPropagation(); // Отменяем клик по родителю
    if (!confirm('Вы уверены, что хотите удалить это вложение?')) return;

    this.taskService.deleteAttachment(id).subscribe({
      next: () => {
        this.attachments.update(current => current.filter(a => a.id !== id));
      },
      error: (err) => {
        console.error('Ошибка удаления файла:', err);
        alert('Не удалось удалить вложение.');
      }
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFileIcon(fileType: string, filename: string): string {
    const type = fileType?.toLowerCase() || '';
    const name = filename.toLowerCase();

    if (type.startsWith('image/') || /\\.(jpg|jpeg|png|gif|webp)$/.test(name)) return 'image';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'picture_as_pdf';
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return 'archive';
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'description';
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'table_chart';
    return 'insert_drive_file';
  }
}
