import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common'; // КРИТИЧНО: должен быть @angular/common

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly location = inject(Location); // Теперь это сервис Angular
  private readonly router = inject(Router);
  private readonly storageKey = 'last_route';

  back(fallbackRoute: string = '/tasks'): void {
    // Проверка истории: 1 — это когда пользователь открыл сайт по прямой ссылке
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate([fallbackRoute]);
    }
  }

  setLastRoute(route: string): void {
    if (route && !route.includes('/login') && !route.includes('/select-company')) {
      localStorage.setItem(this.storageKey, route);
    }
  }

  getLastRoute(): string | null {
    return localStorage.getItem(this.storageKey);
  }
}
