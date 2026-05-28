import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';

export interface RoleResponse {
  id: string;
  name: string;
  workspaceId: string;
  permissions: string[];   // Массив имен: ['user:read', 'task.edit']
  permissionIds: string[]; // Массив UUID: ['uuid-1', 'uuid-2']
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {
  // Базовый URL для работы с ролями
  private readonly baseUrl = `/v1/admin/roles`;

  constructor(private readonly http: HttpClient) {}

  /**
   * Получить все роли текущей пространства пользователя
   */
  getWorkspaceRoles(): Observable<RoleResponse[]> {
    return this.http.get<RoleResponse[]>(this.baseUrl);
  }

  /**
   * Создать новую роль в пространства
   * @param name Название роли (например, 'Manager')
   */
  createRole(name: string): Observable<RoleResponse> {
    return this.http.post<RoleResponse>(this.baseUrl, { name });
  }

  /**
   * Обновить список разрешений для конкретной роли
   * @param roleId ID роли
   * @param permissionIds Массив UUID новых разрешений
   */
  updateRolePermissions(roleId: string, permissionIds: string[]): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${roleId}/permissions`, {
      permissionIds: permissionIds
    });
  }

  /**
   * Удалить роль
   */
  deleteRole(roleId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${roleId}`);
  }
}
