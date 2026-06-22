import { Injectable, signal, effect, inject } from '@angular/core';
import { TranslocoService } from '@ngneat/transloco';

// Строго ограничиваем типы доступных языков на текущий момент
export type AppLanguage = 'en' | 'ru';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translocoService = inject(TranslocoService);

  // Список поддерживаемых языков (пока только два)
  private readonly SUPPORTED_LANGUAGES: AppLanguage[] = ['en', 'ru'];
  private readonly DEFAULT_LANGUAGE: AppLanguage = 'en';

  // Безопасно инициализируем сигнал из localStorage
  readonly language = signal<AppLanguage>(this.getInitialLanguage());

  constructor() {
    // 1. При самом старте приложения принудительно синхронизируем Transloco с сохраненным языком
    this.translocoService.setActiveLang(this.language());

    // 2. Эффект отслеживает любые изменения сигнала (и при старте, и при кликах)
    effect(() => {
      const current = this.language();

      // Синхронизируем Transloco и локальное хранилище
      this.translocoService.setActiveLang(current);
      localStorage.setItem('language', current);

      // Чистим старые классы и вешаем актуальный на body
      this.updateBodyClass(current);
    });
  }

  /**
   * Карусельное переключение: перебирает языки по кругу из массива SUPPORTED_LANGUAGES
   */
  toggleLanguage() {
    this.language.update(current => {
      const currentIndex = this.SUPPORTED_LANGUAGES.indexOf(current);
      // Если индекс последний (1), то (1 + 1) % 2 вернет 0 (вернется к первому элементу)
      const nextIndex = (currentIndex + 1) % this.SUPPORTED_LANGUAGES.length;
      return this.SUPPORTED_LANGUAGES[nextIndex];
    });
  }

  /**
   * Безопасное чтение из localStorage с защитой от некорректных строк
   */
  private getInitialLanguage(): AppLanguage {
    const saved = localStorage.getItem('language') as AppLanguage;
    return this.SUPPORTED_LANGUAGES.includes(saved) ? saved : this.DEFAULT_LANGUAGE;
  }

  /**
   * Динамическое управление классами на теге <body>
   */
  private updateBodyClass(currentLang: AppLanguage) {
    this.SUPPORTED_LANGUAGES.forEach(lang => {
      document.body.classList.remove(`${lang}-language`);
    });
    document.body.classList.add(`${currentLang}-language`);
  }
}
