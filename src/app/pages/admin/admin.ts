
import { CommonModule } from '@angular/common';
import { PermissionManager } from '../../features/admin/permission-manager/permission-manager';
import { RoleManager } from '../../features/admin/role-manager/role-manager';
import {Component} from '@angular/core';
import {Members} from '../members/members';
import {CompanyProfile} from '../../features/admin/company-profile/company-profile';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, PermissionManager, RoleManager, Members, CompanyProfile],
  templateUrl: 'atmm.html',
  styleUrl: './admin.scss'
})
export class AdminPage {
  activeTab: 'profile' | 'members' | 'permissions' | 'roles'  = 'profile';
}
