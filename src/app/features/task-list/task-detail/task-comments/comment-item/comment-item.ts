import { Component, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../../core/services/auth.service';
import { TaskCommentService } from '../../../../../core/services/task-comment.service';
import { TaskComment } from '../../../../../core/models/task/task.model';

@Component({
  selector: 'app-comment-item',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comment-item.html',
  styleUrl: './comment-item.scss'
})
export class CommentItem {
  @Input() comment!: TaskComment;
  @Input() taskId!: string;

  private readonly authService = inject(AuthService);
  private readonly commentService = inject(TaskCommentService);

  currentMember = this.authService.currentMember;
  editing = signal(false);
  editingContent = signal('');
  showReplyForm = signal(false);
  replyContent = signal('');
  isSubmitting = signal(false);

  getAvatarColor(name: string): string {
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  canEdit(): boolean {
    const currentId = this.currentMember()?.id;
    const commentMemberId = this.comment.memberId;
    return currentId === commentMemberId;
  }

  startEdit(): void {
    this.editing.set(true);
    this.editingContent.set(this.comment.content);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editingContent.set('');
  }

  saveEdit(): void {
    const content = this.editingContent().trim();
    if (!content) return;

    this.commentService.updateComment(this.comment.id, { content }).subscribe({
      next: () => {
        this.editing.set(false);
        this.comment.content = content;
        this.comment.status = 'EDITED';
      },
      error: (err) => console.error('Ошибка обновления', err)
    });
  }

  deleteComment(): void {
    if (confirm('Удалить комментарий?')) {
      this.commentService.deleteComment(this.comment.id).subscribe({
        next: () => {
          this.comment.status = 'DELETED';
          this.comment.content = '[Удален]';
        },
        error: (err) => console.error('Ошибка удаления', err)
      });
    }
  }

  toggleReplyForm(): void {
    this.showReplyForm.set(!this.showReplyForm());
    if (!this.showReplyForm()) {
      this.replyContent.set('');
    } else {
      this.replyContent.set(`@${this.comment.authorName} `);
    }
  }

  submitReply(): void {
    const content = this.replyContent().trim();
    if (!content) return;

    this.isSubmitting.set(true);

    let finalContent = content.replace(`@${this.comment.authorName} `, '');

    this.commentService.createComment({
      taskId: this.taskId,
      content: finalContent,
      parentCommentId: this.comment.id
    }).subscribe({
      next: (newReply) => {
        if (!this.comment.replies) this.comment.replies = [];
        this.comment.replies.push(newReply);
        this.replyContent.set('');
        this.showReplyForm.set(false);
        this.isSubmitting.set(false);
      },
      error: (err) => {
        console.error('Ошибка ответа', err);
        this.isSubmitting.set(false);
      }
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();

    // Сравниваем по датам (без времени)
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return `Вчера ${timeStr}`;
    } else {
      return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} ${timeStr}`;
    }
  }
}
