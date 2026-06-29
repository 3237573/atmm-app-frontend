import {ApplicationConfig, inject, isDevMode, provideAppInitializer, provideZoneChangeDetection} from '@angular/core';
import {provideRouter, TitleStrategy} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {routes} from './app.routes';
import {AuthService} from '@core/services/auth.service';
import {LanguageService} from '@core/services/language.service'; // Импортируем твой сервис языка
import {credentialsInterceptor} from '@core/interceptors/credentials.interceptor';
import {apiInterceptor} from '@core/interceptors/api.interceptor';
import {TranslocoHttpLoader} from './transloco-loader';
import {provideTransloco} from '@ngneat/transloco';
import {I18nTitleStrategy} from '@core/strategies/i18n-title.strategy';
import {provideServiceWorker} from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([apiInterceptor, credentialsInterceptor])
    ),
    provideAppInitializer(() => {
      const authService = inject(AuthService);

      // КРИТИЧЕСКИ ВАЖНО: Принудительно вызываем inject для LanguageService.
      // Это заставит отработать его конструктор, прочитать localStorage
      // и настроить Transloco ДО того, как роутер пойдет читать заголовки страниц.
      inject(LanguageService);

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
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(), // Включается только на прод-сборке
      registrationStrategy: 'registerWhenStable:30000'
    }),
    // Наша обновленная стратегия
    { provide: TitleStrategy, useClass: I18nTitleStrategy }
  ],
};
