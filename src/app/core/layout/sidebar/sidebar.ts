import { Component, HostBinding, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {NavigationEnd, Router, RouterLink, RouterLinkActive} from '@angular/router';
import {CompanyService} from '../../services/company/company.service';
import {NavigationService} from '../../services/navigation/navigation.service';
import {filter} from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit {
  private readonly companyService = inject(CompanyService);
  private readonly navigationService = inject(NavigationService);
  private readonly router = inject(Router)

  isCollapsed = false;
  companyName = signal<string>('ATMM');

  @HostBinding('class.collapsed') get collapsed() {
    return this.isCollapsed;
  }

  menuItems = [
    { path: '/members', icon: 'groups', label: 'Members' },
    { path: '/tasks', icon: 'task', label: 'Tasks' },
    { path: '/tracker', icon: 'schedule', label: 'Tracker' },
    { path: '/admin', icon: 'settings', label: 'Admin' }
  ];

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
