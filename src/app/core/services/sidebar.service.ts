// src/app/core/services/sidebar.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SidebarService {
  // Читаем из localStorage начальное состояние
  isCollapsed = signal<boolean>(localStorage.getItem('sidebarCollapsed') !== 'false');

  toggle() {
    this.isCollapsed.update(collapsed => {
      const newState = !collapsed;
      localStorage.setItem('sidebarCollapsed', String(newState));
      return newState;
    });
  }

  close() {
    this.isCollapsed.set(true);
    localStorage.setItem('sidebarCollapsed', 'true');
  }
}
