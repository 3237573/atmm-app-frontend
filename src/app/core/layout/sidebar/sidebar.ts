import {Component, HostBinding, OnInit, inject, signal, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import {NavigationEnd, Router, RouterLink, RouterLinkActive} from '@angular/router';
import {CompanyService} from '../../services/company/company.service';
import {NavigationService} from '../../services/navigation/navigation.service';
import {filter} from 'rxjs';
import {AuthService} from '../../services/auth/auth.service';

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
  private readonly companyService = inject(CompanyService);
  private readonly navigationService = inject(NavigationService);
  private readonly router = inject(Router)

  isCollapsed = false;
  companyName = signal<string>('ATMM');

  @HostBinding('class.collapsed') get collapsed() {
    return this.isCollapsed;
  }

  private readonly allMenuItems: MenuItem[] = [
    { path: '/departments', icon: 'account_tree', label: 'Structure', permission: 'department:read' },
    { path: '/projects', icon: 'folder_copy', label: 'Projects', permission: 'project:read' },
    { path: '/members', icon: 'groups', label: 'Members', permission: 'member:read' },
    { path: '/tasks', icon: 'task', label: 'Tasks', permission: 'task:read' },
    { path: '/tracker', icon: 'schedule', label: 'Tracker', permission: 'tracker:read' },
    { path: '/admin', icon: 'settings', label: 'Admin', permission: 'owner:owner' },
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

    this.loadCompanyName();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (!url.includes('/login') && !url.includes('/select-company')) {
        this.navigationService.setLastRoute(url);
      }
    });
  }

  loadCompanyName() {
    this.companyService.getCompany().subscribe({
      next: (company) => {
        this.companyName.set(company.name);
      },
      error: () => {
        // Если не загрузилось, оставляем 'ATMM'
        this.companyName.set('ATMM');
      }
    });
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem('sidebarCollapsed', `${this.isCollapsed}`);
  }
}
