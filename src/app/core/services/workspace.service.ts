import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {IWorkspace} from '../models/workspace.model';

@Injectable({providedIn: 'root'})
export class WorkspaceService {
  private readonly baseUrl = '/v1/workspace';
  constructor(private readonly http: HttpClient) {}

  getWorkspace(): Observable<IWorkspace> {
    return this.http.get<IWorkspace>(this.baseUrl);
  }

  updateWorkspace(payload: { name: string; code: string }): Observable<IWorkspace> {
    return this.http.patch<IWorkspace>(this.baseUrl, payload);
  }
}
