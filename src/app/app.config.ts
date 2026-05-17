import {
  provideAppInitializer,
  ApplicationConfig,
  provideZoneChangeDetection,
  inject, isDevMode,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {routes} from './app.routes';
import {AuthService} from './core/services/auth.service';
import {credentialsInterceptor} from './core/interceptors/credentials.interceptor';
import {apiInterceptor} from './core/interceptors/api.interceptor';
import {TranslocoHttpLoader} from './transloco-loader';
import {provideTransloco} from '@ngneat/transloco';

function initializeApp(authService: AuthService) {
  return () => authService.checkAuth();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    provideHttpClient(withInterceptors([apiInterceptor, credentialsInterceptor])),
    provideAppInitializer((authService = inject(AuthService)) =>
      authService.checkAuth()), provideHttpClient(), provideTransloco({
      config: {
        availableLangs: ['en', 'ru'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader
    }),
  ],
};
