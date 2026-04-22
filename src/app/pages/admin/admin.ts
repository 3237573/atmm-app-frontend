
import { CommonModule } from '@angular/common';
import { PermissionManager } from '../../features/admin/permission-manager/permission-manager';
import { RoleManager } from '../../features/admin/role-manager/role-manager';
import {Component} from '@angular/core';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, PermissionManager, RoleManager],
  templateUrl: 'atmm.html',
  styleUrl: './admin.scss'
})
export class AdminPage {
  activeTab: 'permissions' | 'roles' = 'roles';
}
