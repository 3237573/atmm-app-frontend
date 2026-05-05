import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly storageKey = 'last_route';

  setLastRoute(route: string): void {
    if (route && !route.includes('/login') && !route.includes('/select-company')) {
      localStorage.setItem(this.storageKey, route);
    }
  }

  getLastRoute(): string | null {
    return localStorage.getItem(this.storageKey);
  }

}
