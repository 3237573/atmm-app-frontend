import {CommonModule} from '@angular/common';
import {Component, OnInit} from '@angular/core';
import {PermissionManager} from '../../features/admin/permission-manager/permission-manager';
import {RoleManager} from '../../features/admin/role-manager/role-manager';
import {MembersAdmin} from '../../features/admin/members-admin/members-admin';
import {WorkspaceProfile} from '../../features/admin/workspace-profile/workspace-profile';
import {TrackerAdmin} from '../../features/admin/tracker-admin/tracker-admin';
import {BackOnEscapeDirective} from '../../core/directives/back-on-escape.directive';
import {DepartmentList} from '@features/department/department-list/department-list';
import {ProjectList} from '@features/project/project-list/project-list';
import {TranslocoPipe} from '@ngneat/transloco';

type TabId = 'profile' | 'departments' | 'projects' | 'members' | 'roles' | 'permissions' | 'tracker';

interface ITab {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, PermissionManager, RoleManager, MembersAdmin, WorkspaceProfile, TrackerAdmin, BackOnEscapeDirective, DepartmentList, ProjectList, TranslocoPipe],
  templateUrl: './admin-page.html',
  styleUrls: ['./admin-page.scss']
})
export class AdminPage implements OnInit {
  activeTab: TabId = 'profile';

  tabs: ITab[] = [  // 👈 указываем тип массива
    { id: 'profile', label: 'admin.tabs.profile', icon: 'business' },
    { id: 'departments', label: 'admin.tabs.departments', icon: 'account_tree' },
    { id: 'projects', label: 'admin.tabs.projects', icon: 'folder_copy' },
    { id: 'members', label: 'admin.tabs.members', icon: 'people' },
    { id: 'roles', label: 'admin.tabs.roles', icon: 'badge' },
    { id: 'permissions', label: 'admin.tabs.permissions', icon: 'security' },
    { id: 'tracker', label: 'admin.tabs.tracker', icon: 'timeline' }
  ];

  ngOnInit() {
    const savedTab = localStorage.getItem('adminActiveTab' as TabId);
    if (savedTab && this.tabs.some(tab => tab.id === savedTab)) {
      this.activeTab = savedTab as TabId;
    }
  }

  setActiveTab(tabId: TabId) {
    this.activeTab = tabId;
    localStorage.setItem('adminActiveTab', tabId);
  }

}
