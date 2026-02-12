import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timer, Observable } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { ExchangePrice } from '../models/crypto.model';

@Injectable({ providedIn: 'root' })
export class CryptoDataService {
  private http = inject(HttpClient);
  
  // URL твоего нового агрегатора на Ktor
  private readonly API_URL = 'http://localhost:9083/api/crypto/prices';

  /**
   * Получает уже готовый массив цен от бэкенда
   */
  getPrices(): Observable<ExchangePrice[]> {
    return this.http.get<ExchangePrice[]>(this.API_URL).pipe(
      catchError((error) => {
        console.error('Ошибка при получении цен с бэкенда:', error);
        // Возвращаем пустой массив, чтобы приложение не падало
        return []; 
      })
    );
  }

  /**
   * Поток, который обновляет данные каждые 10 секунд
   */
  getLivePrices(intervalMs: number = 10000): Observable<ExchangePrice[]> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.getPrices())
    );
  }
}