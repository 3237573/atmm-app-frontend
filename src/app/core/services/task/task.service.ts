import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ITaskRO, ITaskCreateRO, ITaskUpdateRO } from '../../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/v1/tasks';

  getTasks(params?: { status?: string; departmentId?: string; assigneeId?: string }): Observable<ITaskRO[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.departmentId) httpParams = httpParams.set('departmentId', params.departmentId);
    if (params?.assigneeId) httpParams = httpParams.set('assigneeId', params.assigneeId);

    return this.http.get<ITaskRO[]>(`${this.baseUrl}/my`, { params: httpParams });
  }

  getTaskById(id: string): Observable<ITaskRO> {
    return this.http.get<ITaskRO>(`${this.baseUrl}/${id}`);
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
