import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {CreateProjectRO, ProjectRO, UpdateProjectRO} from '../models/project.model';


@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/v1/projects';

  getProjects(): Observable<ProjectRO[]> {
    return this.http.get<ProjectRO[]>(this.baseUrl);
  }

  getProject(id: string): Observable<ProjectRO> {
    return this.http.get<ProjectRO>(`${this.baseUrl}/${id}`);
  }

  createProject(project: CreateProjectRO): Observable<ProjectRO> {
    return this.http.post<ProjectRO>(this.baseUrl, project);
  }

  updateProject(id: string, project: UpdateProjectRO): Observable<ProjectRO> {
    return this.http.put<ProjectRO>(`${this.baseUrl}/${id}`, project);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  assignEmployee(projectId: string, memberId: string, roleInProject: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${projectId}/members`, {memberId, roleInProject});
  }

  updateEmployeeRole(projectId: string, memberId: string, role: string) {
    return this.http.patch(`/v1/departments/${projectId}/members/${memberId}`, { role });
  }


  removeEmployee(projectId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${projectId}/members/${memberId}`);
  }
}
