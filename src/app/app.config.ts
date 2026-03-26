import {
  provideAppInitializer,
  ApplicationConfig,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {routes} from './app.routes';
import {AuthService} from './core/auth/auth.service';
import {credentialsInterceptor} from './core/interceptors/credentials.interceptor';
import {apiInterceptor} from './core/interceptors/api.interceptor';

function initializeApp(authService: AuthService) {
  return () => authService.checkAuth();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiInterceptor, credentialsInterceptor])),
    provideAppInitializer((authService = inject(AuthService)) => authService.checkAuth()),
  ],
};
