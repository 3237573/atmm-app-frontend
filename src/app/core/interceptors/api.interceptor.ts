import {HttpInterceptorFn} from '@angular/common/http';
import {environment} from '../../../environments/environment';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // Check if the path is already complete (for example, if you load icons or a third-party API)
  if (
    req.url.startsWith('http') ||
    req.url.startsWith('assets/') ||
    req.url.startsWith('/assets/') ||
    req.url.includes('assets/i18n/')
  ) {
    return next(req);
  }

  // Clone the request and add the base URL from the environment
  const apiReq = req.clone({
    url: `${environment.apiUrl}${req.url.startsWith('/') ? '' : '/'}${req.url}`
  });

  return next(apiReq);
};
