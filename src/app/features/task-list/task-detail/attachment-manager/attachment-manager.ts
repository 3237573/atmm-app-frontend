import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../../../core/services/task.service';
import { TaskAttachmentRO } from '../../../../core/models/task/task.model';

@Component({
  selector: 'app-task-attachment-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attachment-manager.html',
  styleUrls: ['./attachment-manager.scss']
})
export class AttachmentManager implements OnInit {
  @Input({ required: true }) taskId!: string;
  @Input() initialAttachments: TaskAttachmentRO[] = [];

  private readonly taskService = inject(TaskService);

  // Реактивное состояние через Angular Signals
  attachments = signal<TaskAttachmentRO[]>([]);
  isDragging = signal(false);
  isUploading = signal(false);

  ngOnInit(): void {
    if (this.initialAttachments) {
      this.attachments.set(this.initialAttachments);
    }
  }

  // Срабатывает при выборе файла через стандартный проводник
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFile(input.files[0]);
    }
  }

  // Хэндлеры для Drag & Drop
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.uploadFile(event.dataTransfer.files[0]);
    }
  }

  private uploadFile(file: File): void {
    this.isUploading.set(true);
    this.taskService.uploadAttachment(this.taskId, file).subscribe({
      next: (newAttachment) => {
        // Красиво обновляем сигнал — добавляем новый файл в массив
        this.attachments.update(current => [...current, newAttachment]);
        this.isUploading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки файла:', err);
        this.isUploading.set(false);
        alert('Не удалось загрузить файл. Попробуйте еще раз.');
      }
    });
  }

  deleteAttachment(id: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!confirm('Вы уверены, что хотите удалить этот файл?')) return;

    this.taskService.deleteAttachment(id).subscribe({
      next: () => {
        // Фильтруем массив в сигнале, удаляя элемент
        this.attachments.update(current => current.filter(a => a.id !== id));
      },
      error: (err) => {
        console.error('Ошибка удаления файла:', err);
        alert('Не удалось удалить вложение.');
      }
    });
  }

  // Утилита для красивого отображения размера файла
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Подбор иконки Material Icons в зависимости от расширения
  getFileIcon(fileType: string, filename: string): string {
    const type = fileType?.toLowerCase() || '';
    const name = filename.toLowerCase();

    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/.test(name)) return 'image';
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'picture_as_pdf';
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return 'folder_zip';
    if (name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.txt')) return 'description';
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'table_chart';

    return 'insert_drive_file'; // дефолтная иконка
  }
}
