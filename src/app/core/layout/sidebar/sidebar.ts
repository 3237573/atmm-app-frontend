import {Component, HostBinding, OnInit, inject, signal, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {NavigationEnd, Router, RouterLink, RouterLinkActive} from '@angular/router';
import {WorkspaceService} from '../../services/workspace.service';
import {NavigationService} from '../../services/navigation.service';
import {filter} from 'rxjs';
import {AuthService} from '../../services/auth.service';

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  permission?: string; // Optional field
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly navigationService = inject(NavigationService);
  private readonly router = inject(Router)

  isCollapsed = false;

  @HostBinding('class.collapsed') get collapsed() {
    return this.isCollapsed;
  }

  private readonly allMenuItems: MenuItem[] = [
    // { path: '/departments', icon: 'account_tree', label: 'Structure', permission: 'department:read' },
    // { path: '/projects', icon: 'folder_copy', label: 'Projects', permission: 'project:read' },
    {path: '/members', icon: 'groups', label: 'Members', permission: 'user:read'},
    {path: '/chat', icon: 'chat', label: 'Chat', permission: 'chat:read'},
    {path: '/tasks', icon: 'task', label: 'Tasks', permission: 'task:read'},
    {path: '/tracker', icon: 'schedule', label: 'Tracker', permission: 'tracker:read'},
    {path: '/admin', icon: 'settings', label: 'Admin', permission: 'owner:owner'},
  ];

  menuItems = computed(() => {
    const isAuth = this.auth.isAuthenticated(); // Допустим, есть такой сигнал
    if (!isAuth) return [];

    return this.allMenuItems.filter(item =>
      !item.permission || this.auth.hasPermission(item.permission)
    );
  });

  ngOnInit() {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      this.isCollapsed = saved === 'true';
    }

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (!url.includes('/login') && !url.includes('/select-workspace')) {
        this.navigationService.setLastRoute(url);
      }
    });
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem('sidebarCollapsed', `${this.isCollapsed}`);
  }
}
