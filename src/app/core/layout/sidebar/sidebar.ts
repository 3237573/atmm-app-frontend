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
  protected readonly sidebarService = inject(SidebarService);

  // Привязываем класс .collapsed к хосту компонента на основе сигнала из сервиса
  @HostBinding('class.collapsed') get isHostCollapsed() {
    return this.sidebarService.isCollapsed();
  }

  private readonly allMenuItems: MenuItem[] = [
    { path: '/members', icon: 'groups', label: 'Members', permission: 'user:read' },
    { path: '/chat', icon: 'chat', label: 'Chat', permission: 'chat:read' },
    { path: '/tasks', icon: 'task', label: 'Tasks', permission: 'task:read' },
    { path: '/tracker', icon: 'schedule', label: 'Tracker', permission: 'tracker:read' },
    { path: '/admin', icon: 'settings', label: 'Admin', permission: 'owner:owner' }
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

      // БЕЗОПАСНО: На мобилке закрываем сайдбар (ставим collapsed = true) при смене экрана
      if (window.innerWidth <= 768) {
        // Вызываем метод закрытия из вашего SidebarService
        // Если метода close() нет, можно использовать: this.sidebarService.isCollapsed.set(true);
        if (typeof this.sidebarService.close === 'function') {
          this.sidebarService.close();
        } else {
          // Фолбек, если в сервисе просто открытый сигнал:
          (this.sidebarService.isCollapsed as any).set(true);
        }
      }
    });
  }

  // Двойной клик по пустому месту переключает состояние
  onSidebarDblClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) {
      return;
    }
    // Вызов метода toggle из вашего сервиса
    this.sidebarService.toggle();
  }
}
