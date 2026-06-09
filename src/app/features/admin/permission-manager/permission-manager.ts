import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PermissionService, Permission } from '../../../core/services/admin/permission.service';

@Component({
  selector: 'app-permission-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './permission-manager.html',
  styleUrl: './permission-manager.scss'
})
export class PermissionManager implements OnInit {
  permissions: Permission[] = [];
  newName: string = '';
  loading: boolean = false;

  constructor(private readonly permissionService: PermissionService) {}

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.loading = true;
    this.permissionService.getPermissions().subscribe({
      next: (data) => {
        this.permissions = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  addPermission(): void {
    if (!this.newName.trim()) return;
    this.permissionService.createPermission(this.newName.trim()).subscribe(() => {
      this.newName = '';
      this.loadPermissions();
    });
  }

  removePermission(id: string): void {
    if (confirm('Удалить системное разрешение?')) {
      this.permissionService.deletePermission(id).subscribe(() => this.loadPermissions());
    }
  }
}
