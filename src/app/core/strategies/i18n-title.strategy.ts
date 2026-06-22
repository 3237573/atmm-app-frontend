import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@ngneat/transloco';
import { BehaviorSubject, filter, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly transloco = inject(TranslocoService);
  private readonly titleService = inject(Title);

  // Создаем поток для хранения текущего ключа роута (например, 'routes.tasks')
  private readonly titleKey$ = new BehaviorSubject<string>('');

  constructor() {
    super();

    // Магия RxJS: связываем ключ страницы с реактивным переводом Transloco
    this.titleKey$.pipe(
      // Игнорируем пустые значения при старте
      filter(key => !!key),
      // selectTranslate автоматически:
      // 1. Дождется загрузки JSON-файла с сервера (ошибка пропадет!)
      // 2. Будет сам реагировать на изменения языка в приложении
      switchMap(key => this.transloco.selectTranslate(key))
    ).subscribe(translatedTitle => {
      this.titleService.setTitle(`${translatedTitle}`);
    });
  }

  override updateTitle(routerState: RouterStateSnapshot): void {
    const titleKey = this.buildTitle(routerState);

    if (titleKey) {
      // Просто пушим новый ключ в поток, остальное за нас сделает подписка выше
      this.titleKey$.next(titleKey);
    }
  }
}
