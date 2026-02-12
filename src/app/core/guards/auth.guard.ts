import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Проверяем сигнал isAuthenticated, который мы заполнили в checkAuth
  if (authService.isAuthenticated()) {
    return true; // Доступ разрешен
  }

  // Если не авторизован — отправляем на логин
  return router.parseUrl('/login');
};