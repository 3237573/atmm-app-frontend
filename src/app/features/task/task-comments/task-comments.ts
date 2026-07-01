import { Component, Input, inject, signal, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { TaskCommentService } from '@core/services/task-comment.service';
import { TaskComment } from '@core/models/task/task.model';
import { CommentItem } from '@features/task/task-comments/comment-item/comment-item';
import { TranslocoPipe, TranslocoService } from '@ngneat/transloco';

@Component({
  selector: 'app-task-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, CommentItem, TranslocoPipe],
  templateUrl: './task-comments.html',
  styleUrl: './task-comments.scss'
})
export class TaskComments implements OnChanges {
  @Input() taskId!: string;
  @Input() reloadTrigger: number = 0;

  private readonly authService = inject(AuthService);
  private readonly commentService = inject(TaskCommentService);
  private readonly translocoService = inject(TranslocoService);

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

  onKeyDown(event: KeyboardEvent): void {
    // Если нажат Enter БЕЗ зажатого Shift
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Предотвращаем стандартный перенос строки
      this.onSubmit(); // Отправляем комментарий
    }
    // Если нажат Shift + Enter, браузер сам сделает перенос строки, мы ничего не делаем
  }

  loadComments(): void {
    if (!this.taskId) return;
    this.loading.set(true);
    this.commentService.getTaskComments(this.taskId).subscribe({
      next: (data) => {
        this.comments.set(this.buildCommentTree(data));
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  buildCommentTree(flatComments: TaskComment[]): TaskComment[] {
    const commentMap = new Map<string, TaskComment>();
    flatComments.forEach(c => commentMap.set(c.id, { ...c, replies: [] }));

    const rootComments: TaskComment[] = [];
    flatComments.forEach(c => {
      const commentWithReplies = commentMap.get(c.id)!;
      if (c.parentCommentId && commentMap.has(c.parentCommentId)) {
        const parent = commentMap.get(c.parentCommentId)!;
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
        console.error(this.translocoService.translate('task.comments.errors.create'), err);
        this.isSubmitting.set(false);
      }
    });
  }
}
