import {
  provideAppInitializer,
  ApplicationConfig,
  provideZoneChangeDetection,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';

function initializeApp(authService: AuthService) {
  return () => authService.checkAuth();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAppInitializer((authService = inject(AuthService)) => authService.checkAuth()),
  ],
};
