import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {TaskComment} from '../../models/task/task.model';
import {ITaskCommentCreateRequest, ITaskCommentUpdateRequest} from '../../models/task/task-comment.model';


@Injectable({ providedIn: 'root' })
export class TaskCommentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/v1/task-comments';

  getTaskComments(taskId: string): Observable<TaskComment[]> {
    return this.http.get<TaskComment[]>(`${this.baseUrl}/task/${taskId}`);
  }

  createComment(request: ITaskCommentCreateRequest): Observable<TaskComment> {
    return this.http.post<TaskComment>(this.baseUrl, request);
  }

  updateComment(commentId: string, request: ITaskCommentUpdateRequest): Observable<TaskComment> {
    return this.http.put<TaskComment>(`${this.baseUrl}/${commentId}`, request);
  }

  deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${commentId}`);
  }
}
