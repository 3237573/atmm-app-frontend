import {inject} from '@angular/core';
import {CanActivateChildFn, Router} from '@angular/router';
import {AuthService} from '../services/auth.service';

export const permissionGuard: CanActivateChildFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Теперь здесь будет актуальный snapshot дочернего роута при переходах во внутренние разделы
  const requiredPermission = route.data['permission'] as string;

  // Если право не указано или оно есть у пользователя — пускаем
  if (!requiredPermission || authService.hasPermission(requiredPermission)) {
    return true;
  }

  // Безопасный редирект на трекер (доступный всем), чтобы избежать бесконечного цикла
  return router.parseUrl('/tracker');
};
