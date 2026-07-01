import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Permission, PermissionService} from '@core/services/admin/permission.service';
import {TranslocoModule, TranslocoService} from '@ngneat/transloco';

@Component({
  selector: 'app-permission-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './permission-manager.html',
  styleUrl: './permission-manager.scss'
})
export class PermissionManager implements OnInit {
  permissions: Permission[] = [];
  newName: string = '';
  loading: boolean = false;

  constructor(
    private readonly permissionService: PermissionService,
    private readonly translocoService: TranslocoService
  ) {}

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
    if (confirm(this.translocoService.translate('admin.permissions.confirmDelete'))) {
      this.permissionService.deletePermission(id).subscribe(() => {
        this.loadPermissions();
      });
    }
  }
}
