import { Component, HostBinding, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {CompanyService} from '../../services/company/company.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar implements OnInit {
  private readonly companyService = inject(CompanyService);

  isCollapsed = false;
  companyName = signal<string>('ATMM');

  @HostBinding('class.collapsed') get collapsed() {
    return this.isCollapsed;
  }

  menuItems = [
    { path: '/members', icon: 'groups', label: 'Members' },
    { path: '/tracker', icon: 'schedule', label: 'Tracker' },
    { path: '/admin', icon: 'settings', label: 'Admin' }
  ];

  ngOnInit() {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      this.isCollapsed = saved === 'true';
    }

    this.loadCompanyName();
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
