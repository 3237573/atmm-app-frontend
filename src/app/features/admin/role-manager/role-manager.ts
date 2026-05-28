// src/app/features/admin-page/role-manager/role-manager.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermissionService, Permission } from '../../../core/services/admin/permission.service';
import { RoleService, RoleResponse } from '../../../core/services/admin/role.service';

@Component({
  selector: 'app-role-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-manager.html',
  styleUrl: './role-manager.scss'
})
export class RoleManager implements OnInit {
  roles: RoleResponse[] = [];
  allPermissions: Permission[] = [];
  selectedRole: RoleResponse | null = null;

  // Храним выбранные ID прав для текущей роли
  selectedPermissionIds: Set<string> = new Set();

  constructor(
    private readonly permissionService: PermissionService,
    private readonly roleService: RoleService
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.permissionService.getPermissions().subscribe(p => this.allPermissions = p);
    this.roleService.getWorkspaceRoles().subscribe(r => this.roles = r);
  }

  selectRole(role: RoleResponse) {
    this.selectedRole = role;
    // Заполняем Set текущими правами роли для быстрой проверки чекбоксов
    this.selectedPermissionIds = new Set(role.permissionIds);
  }

  togglePermission(id: string) {
    if (this.selectedPermissionIds.has(id)) {
      this.selectedPermissionIds.delete(id);
    } else {
      this.selectedPermissionIds.add(id);
    }
  }

  saveRole() {
    if (!this.selectedRole) return;

    const ids = Array.from(this.selectedPermissionIds);

    // 🔥 Возвращаем боевой запрос к сервису
    this.roleService.updateRolePermissions(this.selectedRole.id, ids).subscribe({
      next: () => {
        // Синхронизируем локальный объект, чтобы счётчик прав в UI обновился мгновенно
        this.selectedRole!.permissionIds = ids;

        // Перезагружаем общий список ролей с бэка
        this.loadData();

        console.log('Права роли успешно обновлены в базе!');
      },
      error: (err) => {
        console.error('Произошла ошибка при сохранении прав:', err);
      }
    });
  }
}
