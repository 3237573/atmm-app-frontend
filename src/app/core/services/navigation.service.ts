import { inject, Injectable, Injector } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Location } from '@angular/common';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly storageKey = 'last_route';

  private readonly historyMap = new Map<number, string>();
  private isNavigating = false;

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      const navId = history.state?.navigationId;
      if (navId) {
        this.historyMap.set(navId, event.urlAfterRedirects);
      }
    });
  }

  back(fallbackRoute: string = '/tasks'): void {
    if (this.isNavigating) return;
    this.isNavigating = true;

    const currentNavId = history.state?.navigationId;
    const currentUrl = this.router.url;

    let targetUrl: string | undefined;
    let targetNavId: number | undefined;

    const getCleanPath = (url: string) => url.split('?')[0].split('#')[0].replace(/\/$/, '');
    const currentCleanPath = getCleanPath(currentUrl);

    // 1. ИЩЕМ РЕАЛЬНЫЙ ПРЕДЫДУЩИЙ ШАГ В ИСТОРИИ
    if (currentNavId && currentNavId > 1) {
      let checkNavId = currentNavId - 1;
      while (checkNavId > 0) {
        const url = this.historyMap.get(checkNavId);
        if (url) {
          const candidateCleanPath = getCleanPath(url);

          // Игнорируем только экраны авторизации
          const isAuthRoute = candidateCleanPath.includes('/login') ||
            candidateCleanPath.includes('/register') ||
            candidateCleanPath.includes('/auth');

          const isSamePath = candidateCleanPath === currentCleanPath;

          // Защита от бесконечного цикла: если мы вышли на родительский роут,
          // кнопка "Назад" не должна швырять нас обратно внутрь дочернего роута.
          const isSubRouteOfCurrent = candidateCleanPath.startsWith(currentCleanPath + '/');

          if (!isAuthRoute && !isSamePath && !isSubRouteOfCurrent) {
            targetUrl = url;
            targetNavId = checkNavId;
            break; // Нашли реальный предыдущий шаг!
          }
        }
        checkNavId--;
      }
    }

    // 2. ВЫПОЛНЯЕМ НАВИГАЦИЮ
    if (targetUrl && targetNavId !== undefined) {
      // Переходим строго на вычисленный шаг назад в истории браузера
      const delta = targetNavId - currentNavId;
      window.history.go(delta);
    } else {
      // ИСТОРИИ НЕТ (например, после F5) -> Вычисляем динамический fallback на основе текущего модуля
      let dynamicFallback = fallbackRoute;

      if (currentCleanPath.startsWith('/chat')) {
        dynamicFallback = '/chat';
      } else if (currentCleanPath.startsWith('/admin')) {
        dynamicFallback = '/admin';
      } else if (currentCleanPath.startsWith('/departments')) {
        dynamicFallback = '/departments';
      }

      // Если мы уже на этом fallback-роуте, ничего не делаем, иначе переходим
      if (currentCleanPath !== getCleanPath(dynamicFallback)) {
        void this.router.navigate([dynamicFallback]);
      }
    }

    setTimeout(() => this.isNavigating = false, 300);
  }

  setLastRoute(route: string): void {
    if (route && !route.includes('/login') && !route.includes('/select-workspace')) {
      localStorage.setItem(this.storageKey, route);
    }
  }

  getLastRoute(): string | null {
    let route = localStorage.getItem(this.storageKey);
    if (route?.includes('/register')) return null;
    return route;
  }
}
