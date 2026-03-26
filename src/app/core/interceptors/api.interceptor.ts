import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // Проверяем, не является ли путь уже полным (например, если вы грузите иконки или сторонний API)
  if (req.url.startsWith('http') || req.url.startsWith('assets/')) {
    return next(req);
  }

  // Клонируем запрос и добавляем базовый URL из environment
  const apiReq = req.clone({
    url: `${environment.apiUrl}${req.url.startsWith('/') ? '' : '/'}${req.url}`
  });

  return next(apiReq);
};
