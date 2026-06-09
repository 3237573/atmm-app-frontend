import {inject, Injectable} from "@angular/core";
import {TranslocoLoader} from "@ngneat/transloco";
import {HttpClient} from "@angular/common/http";

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    // Убираем слеш в начале, чтобы сработал req.url.startsWith('assets/')
    return this.http.get(`/assets/i18n/${lang}.json`);
  }
}
