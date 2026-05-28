import { Component, HostBinding, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { NavigationService } from '../../services/navigation.service';
import { SidebarService } from '../../services/sidebar.service';
import { AuthService } from '../../services/auth.service';
import { filter } from 'rxjs';

interface MenuItem {
  path: string;
  label: string;
  icon: string;
  permission?: string;
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
  private readonly router = inject(Router);
  protected readonly sidebarService = inject(SidebarService); // Наш единый источник истины

  // 1. ИСПРАВЛЕНО: Привязываем класс к хосту. Чтобы избежать дублирования имён,
  // переименуем геттер в "isHostCollapsed". Он просто возвращает значение сигнала.
  @HostBinding('class.collapsed') get isHostCollapsed() {
    return this.sidebarService.isCollapsed();
  }

  private readonly allMenuItems: MenuItem[] = [
    { path: '/members', icon: 'groups', label: 'Members', permission: 'user:read' },
    { path: '/chat', icon: 'chat', label: 'Chat', permission: 'chat:read' },
    { path: '/tasks', icon: 'task', label: 'Tasks', permission: 'task:read' },
    { path: '/tracker', icon: 'schedule', label: 'Tracker', permission: 'tracker:read' },
    { path: '/admin', icon: 'settings', label: 'Admin', permission: 'owner:owner' },
  ];

  menuItems = computed(() => {
    if (!this.auth.isAuthenticated()) return [];
    return this.allMenuItems.filter(item =>
      !item.permission || this.auth.hasPermission(item.permission)
    );
  });

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects;
      if (!url.includes('/login') && !url.includes('/select-workspace')) {
        this.navigationService.setLastRoute(url);
      }
      // Автоматически закрываем сайдбар на мобилке при смене роута
      if (window.innerWidth <= 768) {
        this.sidebarService.close(); // Предполагается, что в сервисе есть метод close или toggle(true)
      }
    });
  }

  // 2. ИСПРАВЛЕНО: Двойной клик теперь дёргает СИГНАЛ в сервисе
  onSidebarDblClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Если кликнули по пустому месту, nav-списку или самому фону
    if (
      target.tagName === 'NAV' ||
      target.classList.contains('sidebar-empty-space') ||
      target.classList.contains('nav-list')
    ) {
      this.sidebarService.toggle(); // Переключаем глобальный сигнал!
    }
  }
}
