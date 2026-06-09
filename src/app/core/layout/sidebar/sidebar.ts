// src/app/core/layout/sidebar/sidebar.ts
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
  private readonly authService = inject(AuthService);
  private readonly navigationService = inject(NavigationService);
  private readonly router = inject(Router);
  protected readonly sidebarService = inject(SidebarService);

  readonly currentUserEmail = computed(() => this.authService.currentUser()?.email ?? 'none');
  readonly currentUserName = computed(() => this.authService.currentUser()?.displayName ?? 'none');

  @HostBinding('class.collapsed') get isHostCollapsed() {
    return this.sidebarService.isCollapsed();
  }

  private readonly allMenuItems: MenuItem[] = [
    { path: '/members', icon: 'groups', label: 'Members', permission: 'user:read' },
    { path: '/chat', icon: 'chat', label: 'Chat', permission: 'chat:read' },
    { path: '/tasks', icon: 'account_tree', label: 'Tasks', permission: 'task:read' },
    { path: '/tracker', icon: 'schedule', label: 'Tracker', permission: 'tracker:read' },
    { path: '/admin', icon: 'settings', label: 'Admin', permission: 'owner:owner' }
  ];

  menuItems = computed(() => {
    if (!this.authService.isAuthenticated()) return [];
    return this.allMenuItems.filter(item =>
      !item.permission || this.authService.hasPermission(item.permission)
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

      if (window.innerWidth <= 768) {
        if (typeof this.sidebarService.close === 'function') {
          this.sidebarService.close();
        } else {
          (this.sidebarService.isCollapsed as any).set(true);
        }
      }
    });
  }

  // Method of handling double clicking on the panel
  onNavbarDblClick(event: MouseEvent): void {
    // Ignoring double clicks on mobile phones (the sidebar works as an overlay there)
    if (window.innerWidth <= 768) return;

    const collapsedSignal = this.sidebarService.isCollapsed as any;
    if (collapsedSignal && typeof collapsedSignal.set === 'function') {
      collapsedSignal.set(!this.sidebarService.isCollapsed());
    }
  }

  // Pure method of clicking on the arrow (leave it as is)
  toggleSidebar(event: MouseEvent): void {
    event.stopPropagation();
    const collapsedSignal = this.sidebarService.isCollapsed as any;
    if (collapsedSignal && typeof collapsedSignal.set === 'function') {
      collapsedSignal.set(!this.sidebarService.isCollapsed());
    }
  }
}
