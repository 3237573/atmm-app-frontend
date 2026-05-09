import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {CreateProjectRO, ProjectRO, UpdateProjectRO} from '../../models/project.model';


@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/v1/projects';

  getProjects(): Observable<ProjectRO[]> {
    return this.http.get<ProjectRO[]>(this.apiUrl);
  }

  getProject(id: string): Observable<ProjectRO> {
    return this.http.get<ProjectRO>(`${this.apiUrl}/${id}`);
  }

  createProject(project: CreateProjectRO): Observable<ProjectRO> {
    return this.http.post<ProjectRO>(this.apiUrl, project);
  }

  updateProject(id: string, project: UpdateProjectRO): Observable<ProjectRO> {
    return this.http.put<ProjectRO>(`${this.apiUrl}/${id}`, project);
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
