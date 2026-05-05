import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {TaskRO, ITaskCreateRO, ITaskUpdateRO, TaskTreeRO} from '../../models/task/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/v1/tasks';

  getTasks(params?: { status?: string; departmentId?: string; assigneeId?: string }): Observable<TaskRO[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.departmentId) httpParams = httpParams.set('departmentId', params.departmentId);
    if (params?.assigneeId) httpParams = httpParams.set('assigneeId', params.assigneeId);

    return this.http.get<TaskRO[]>(`${this.baseUrl}/my`, { params: httpParams });
  }

  getMyTaskTree(): Observable<TaskTreeRO[]> {
    return this.http.get<TaskTreeRO[]>(`${this.baseUrl}/my/tree`);
  }

  getTaskById(id: string): Observable<TaskRO> {
    return this.http.get<TaskRO>(`${this.baseUrl}/${id}`);
  }

  getTaskTree(taskId: string): Observable<TaskTreeRO> {
    return this.http.get<TaskTreeRO>(`${this.baseUrl}/${taskId}/tree`);
  }

  createTask(request: ITaskCreateRO): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(this.baseUrl, request);
  }

  updateTask(id: string, request: ITaskUpdateRO): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}`, request);
  }

  updateTaskStatus(id: string, status: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/status`, { status });
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
