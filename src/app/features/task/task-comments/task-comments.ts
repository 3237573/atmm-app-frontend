import { Component, Input, inject, signal, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { TaskCommentService } from '@core/services/task-comment.service';
import { TaskComment } from '@core/models/task/task.model';
import { CommentItem } from '@features/task/task-comments/comment-item/comment-item';

@Component({
  selector: 'app-task-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentItem],
  templateUrl: './task-comments.html',
  styleUrl: './task-comments.scss'
})
export class TaskComments implements OnChanges {
  @Input() taskId!: string;
  @Input() reloadTrigger: number = 0;

  private readonly authService = inject(AuthService);
  private readonly commentService = inject(TaskCommentService);

  currentUser = this.authService.currentUser;
  comments = signal<TaskComment[]>([]);
  loading = signal(true);
  newComment = signal('');
  isSubmitting = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['taskId'] && this.taskId) || changes['reloadTrigger']) {
      this.loadComments();
    }
  }

  loadComments(): void {
    if (!this.taskId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.commentService.getTaskComments(this.taskId).subscribe({
      next: (data) => {
        this.comments.set(this.buildCommentTree(data));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки комментариев', err);
        this.loading.set(false);
      }
    });
  }

  buildCommentTree(comments: TaskComment[]): TaskComment[] {
    const commentMap = new Map<string, TaskComment>();
    const rootComments: TaskComment[] = [];

    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parentCommentId && commentMap.has(comment.parentCommentId)) {
        const parent = commentMap.get(comment.parentCommentId)!;
        if (!parent.replies) parent.replies = [];
        parent.replies.push(commentWithReplies);
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  }

  onSubmit(): void {
    const content = this.newComment().trim();
    if (!content) return;

    this.isSubmitting.set(true);
    this.commentService.createComment({
      taskId: this.taskId,
      content: content,
      parentCommentId: undefined
    }).subscribe({
      next: () => {
        this.newComment.set('');
        this.isSubmitting.set(false);
        this.loadComments();
      },
      error: (err) => {
        console.error('Ошибка создания комментария', err);
        this.isSubmitting.set(false);
      }
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Вчера';
    } else if (days < 7) {
      return `${days} дн. назад`;
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  }
}
