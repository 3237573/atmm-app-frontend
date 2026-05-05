import { Injectable, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);
  private readonly storageKey = 'last_route';

  constructor() {
    // Сохраняем маршрут при каждом переходе
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Не сохраняем страницы логина и выбора компании
      if (!event.url.includes('/login') && !event.url.includes('/select-company')) {
        localStorage.setItem(this.storageKey, event.url);
      }
    });
  }

  getLastRoute(): string | null {
    return localStorage.getItem(this.storageKey);
  }

  clearLastRoute(): void {
    localStorage.removeItem(this.storageKey);
  }
}
