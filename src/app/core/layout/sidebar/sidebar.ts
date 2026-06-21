// src/app/core/layout/sidebar/sidebar.ts
import { Component, HostBinding, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NavigationService } from '../../services/navigation.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { filter } from 'rxjs';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {TranslocoPipe, TranslocoService} from '@ngneat/transloco';

interface MenuItem {
  path: string;
  labelKey: string;
  icon: string;
  permission?: string;
}
const menuTranslatePath: string = "menu.";


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, BackOnEscapeDirective, TranslocoPipe],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly navigationService = inject(NavigationService);
  private readonly router = inject(Router);
  protected readonly sidebarService = inject(SidebarService);
  private readonly translocoService = inject(TranslocoService);


  readonly currentUserEmail = computed(() => this.authService.currentUser()?.email ?? 'none');
  readonly currentUserName = computed(() => this.authService.currentUser()?.displayName ?? 'none');

  @HostBinding('class.collapsed') get isHostCollapsed() {
    return this.sidebarService.isCollapsed();
  }

  private readonly allMenuItems: MenuItem[] = [
    { path: '/members', icon: 'groups', labelKey: 'menu.members', permission: 'user:read' },
    { path: '/chat', icon: 'chat', labelKey: 'menu.chat', permission: 'chat:read' },
    { path: '/tasks', icon: 'account_tree', labelKey: 'menu.tasks', permission: 'task:read' },
    { path: '/tracker', icon: 'schedule', labelKey: 'menu.tracker', permission: 'tracker:read' },
    { path: '/admin', icon: 'settings', labelKey: 'menu.admin', permission: 'owner:owner' }
  ];

  menuItems = computed(() => {
    if (!this.authService.isAuthenticated()) return [];
    return this.allMenuItems.filter(item =>
      !item.permission || this.authService.hasPermission(item.permission)
    );
  });

  // src/app/core/layout/sidebar/sidebar.ts

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (!url.includes('/login') && !url.includes('/select-workspace')) {
        this.navigationService.setLastRoute(url);
      }

      // На мобилках (экран <= 768px) всегда принудительно закрываем сайдбар
      if (window.innerWidth <= 768) {
        this.sidebarService.close();
      }
    });
  }

// Обработка двойного клика по панели
  onNavbarDblClick(event: MouseEvent): void {
    // Игнорируем на мобилках
    if (window.innerWidth <= 768) return;

    // 🌟 Вызываем метод сервиса, чтобы состояние сохранилось в localStorage!
    this.sidebarService.toggle();
  }

// Клик по стрелочке
  toggleSidebar(event: MouseEvent): void {
    event.stopPropagation();

    // 🌟 Вызываем метод сервиса, чтобы состояние сохранилось в localStorage!
    this.sidebarService.toggle();
  }
}
