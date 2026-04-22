import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Permission {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly baseUrl = `/v1/admin/permissions`;

  constructor(private readonly http: HttpClient) {}

  getPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(this.baseUrl);
  }

  createPermission(name: string): Observable<Permission> {
    return this.http.post<Permission>(this.baseUrl, { name });
  }

  deletePermission(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
