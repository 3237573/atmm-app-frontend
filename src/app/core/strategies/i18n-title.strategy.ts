import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';

@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly transloco = inject(TranslocoService);
  private readonly titleService = inject(Title);

  constructor() {
    super();
    // Автоматически обновляем заголовок вкладки при смене языка в приложении
    this.transloco.langChanges$.subscribe(() => {
      // Перерасчитываем текущий заголовок, используя сохраненное состояние
      if (this.lastTitleKey) {
        this.updateTitleWithTranslation(this.lastTitleKey);
      }
    });
  }

  private lastTitleKey = '';

  override updateTitle(routerState: RouterStateSnapshot): void {
    const titleKey = this.buildTitle(routerState);

    if (titleKey) {
      this.lastTitleKey = titleKey;
      this.updateTitleWithTranslation(titleKey);
    }
  }

  private updateTitleWithTranslation(key: string): void {
    // Получаем перевод по ключу (например, 'routes.tracker')
    const translatedTitle = this.transloco.translate(key);

    // Форматируем заголовок (например: "Трекер | ATMM")
    this.titleService.setTitle(`${translatedTitle}`);
  }
}
