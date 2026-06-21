import {ApplicationConfig, inject, isDevMode, provideAppInitializer, provideZoneChangeDetection,} from '@angular/core';
import {provideRouter, TitleStrategy} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {routes} from './app.routes';
import {AuthService} from '@core/services/auth.service';
import {credentialsInterceptor} from '@core/interceptors/credentials.interceptor';
import {apiInterceptor} from '@core/interceptors/api.interceptor';
import {TranslocoHttpLoader} from './transloco-loader';
import {provideTransloco} from '@ngneat/transloco';
import {I18nTitleStrategy} from '@core/strategies/i18n-title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([apiInterceptor, credentialsInterceptor])
    ),
    provideAppInitializer(() => {
      const authService = inject(AuthService);
      return authService.checkAuth();
    }),
    provideTransloco({
      config: {
        availableLangs: ['en', 'ru'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader
    }),
    {provide: TitleStrategy, useClass: I18nTitleStrategy}
  ],
};
