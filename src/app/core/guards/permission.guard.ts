import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import {AuthService} from '../services/auth/auth.service';

export const permissionGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Извлекаем требуемое право из данных роута
  const requiredPermission = route.data['permission'] as string;

  // Если право не указано или оно есть у пользователя — пускаем
  if (!requiredPermission || authService.hasPermission(requiredPermission)) {
    return true;
  }

  // Если прав нет — редиректим на главную или страницу "403 No Access"
  return router.parseUrl('/tracker');
};
