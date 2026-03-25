import { HttpInterceptorFn } from '@angular/common/http';

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  // Клонируем любой запрос и добавляем ему флаг для передачи кук
  const credReq = req.clone({
    withCredentials: true
  });

  return next(credReq);
};
