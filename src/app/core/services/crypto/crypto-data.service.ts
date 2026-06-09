import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {ExchangePrice, ExchangeSpread} from '@core/models';

@Injectable({ providedIn: 'root' })
export class CryptoDataService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = '/api/crypto';

  getCoins(): Observable<{ symbol: string; fullName: string }[]> {
    return this.http
      .get<{ symbol: string; fullName: string }[]>(`${this.API_URL}/coins`)
      .pipe(catchError(() => of([])));
  }

  getPrices(symbol: string): Observable<ExchangePrice[]> {
    const params = new HttpParams().set('symbol', symbol);

    return this.http.get<ExchangePrice[]>(`${this.API_URL}/prices`, { params }).pipe(
      catchError((error) => {
        console.error(`Ошибка API (${symbol}):`, error);
        return of([]); // Возвращаем пустой массив, чтобы поток не прерывался
      }),
    );
  }

  getGlobalSpreads(): Observable<ExchangeSpread[]> {
    return this.http.get<ExchangeSpread[]>(`${this.API_URL}/spreads`);
  }
}


