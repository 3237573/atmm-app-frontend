import {CommonModule} from '@angular/common';
import {Component, OnInit} from '@angular/core';
import {PermissionManager} from '../../features/admin/permission-manager/permission-manager';
import {RoleManager} from '../../features/admin/role-manager/role-manager';
import {MembersAdmin} from '../../features/admin/members-admin/members-admin';
import {CompanyProfile} from '../../features/admin/company-profile/company-profile';
import {TrackerAdmin} from '../../features/admin/tracker-admin/tracker-admin';
import {BackOnEscapeDirective} from '../../core/directives/back-on-escape.directive';

type TabId = 'profile' | 'members' | 'roles' | 'permissions' | 'tracker';

interface ITab {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule, PermissionManager, RoleManager, MembersAdmin, CompanyProfile, TrackerAdmin, BackOnEscapeDirective],
  templateUrl: './admin-page.html',
  styleUrls: ['./admin-page.scss']
})
export class AdminPage implements OnInit {
  activeTab: TabId = 'profile';

  tabs: ITab[] = [  // 👈 указываем тип массива
    { id: 'profile', label: 'Profile', icon: 'business' },
    { id: 'members', label: 'Members', icon: 'people' },
    { id: 'roles', label: 'Roles', icon: 'badge' },
    { id: 'permissions', label: 'Permissions', icon: 'security' },
    { id: 'tracker', label: 'Tracker', icon: 'timeline' }
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
