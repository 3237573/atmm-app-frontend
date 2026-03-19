// src/app/core/services/dex-spread.service.ts

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';
import {
  DexNetwork,
  DexSpread,
  ArbitrageResult
} from '../models/dex.model';

@Injectable({ providedIn: 'root' })
export class DexSpreadService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:9083/api/dex';
  private readonly TIMEOUT = 10000;

  /**
   * Получение списка сетей
   */
  getNetworks(): Observable<DexNetwork[]> {
    return this.http.get<any[]>(`${this.API_URL}/networks`).pipe(
      timeout(this.TIMEOUT),
      map(response => {
        if (!Array.isArray(response)) return [];
        return response.map(item => ({
          id: item.id,
          name: item.name,
          chainId: item.chainId,
          rpcUrl: item.rpcUrl || '',
          nativeCurrency: item.nativeCurrency,
          explorerUrl: item.explorerUrl,
          isEnabled: item.isEnabled,
          logoUrl: item.logoUrl
        }));
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Ошибка загрузки сетей DEX:', error);
        return of([]);
      })
    );
  }

  /**
   * Получение списка протоколов
   */
  getProtocols(): Observable<string[]> {
    return this.http.get<any[]>(`${this.API_URL}/protocols`).pipe(
      timeout(this.TIMEOUT),
      map(response => {
        if (!Array.isArray(response)) return [];
        return response.map(p => p.name);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Ошибка загрузки протоколов DEX:', error);
        return of([]);
      })
    );
  }

  /**
   * Получение топ спредов
   */
  getTopSpreads(limit: number = 50): Observable<DexSpread[]> {
    const params = new HttpParams().set('limit', limit.toString());

    return this.http.get<any[]>(`${this.API_URL}/spreads/top`, { params }).pipe(
      timeout(this.TIMEOUT),
      map(response => {
        if (!Array.isArray(response)) return [];
        return this.mapToDexSpreads(response);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Ошибка загрузки DEX спредов:', error);
        // При любой ошибке возвращаем пустой массив
        return of([]);
      })
    );
  }

  /**
   * Получение спредов для конкретной монеты
   */
  getSpreadsForCoin(symbol: string): Observable<DexSpread[]> {
    const params = new HttpParams().set('symbol', symbol.toUpperCase());

    return this.http.get<any[]>(`${this.API_URL}/spreads`, { params }).pipe(
      timeout(this.TIMEOUT),
      map(response => {
        if (!Array.isArray(response)) return [];
        return this.mapToDexSpreads(response);
      }),
      catchError((error: HttpErrorResponse) => {
        console.error(`Ошибка загрузки спредов для ${symbol}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Маппинг ответа от бэкенда в модель DexSpread
   */
  private mapToDexSpreads(data: any[]): DexSpread[] {
    return data.map(item => ({
      coinSymbol: item.coinSymbol,
      buy: {
        protocol: item.buy?.protocol || '',
        network: item.buy?.network || '',
        pool: item.buy?.pool || '',
        price: item.buy?.price || 0,
        liquidityUsd: item.buy?.liquidityUsd
      },
      sell: {
        protocol: item.sell?.protocol || '',
        network: item.sell?.network || '',
        pool: item.sell?.pool || '',
        price: item.sell?.price || 0,
        liquidityUsd: item.sell?.liquidityUsd
      },
      spreadPct: item.spreadPct || 0,
      spreadCash: item.spreadCash || 0,
      estimatedGas: item.estimatedGas || {
        networkId: item.network?.toLowerCase() || '',
        gasPriceGwei: 0,
        estimatedGasUnits: 0,
        totalGasCostEth: 0,
        totalGasCostUsd: 0
      },
      network: item.network || '',
      timestamp: item.timestamp || Date.now()
    }));
  }

  /**
   * Выполнение арбитража
   */
  executeArbitrage(spread: DexSpread, walletAddress: string): Observable<ArbitrageResult> {
    const body = {
      coinSymbol: spread.coinSymbol,
      buyProtocol: spread.buy.protocol,
      buyNetwork: spread.buy.network,
      buyPool: spread.buy.pool,
      buyPrice: spread.buy.price,
      sellProtocol: spread.sell.protocol,
      sellNetwork: spread.sell.network,
      sellPool: spread.sell.pool,
      sellPrice: spread.sell.price,
      walletAddress: walletAddress,
      amount: '1000000000000000000'
    };

    return this.http.post<any>(`${this.API_URL}/arbitrage/execute`, body).pipe(
      timeout(this.TIMEOUT * 2),
      map(response => ({
        txHash: response.txHash,
        networkId: response.networkId,
        buyAmount: response.buyAmount,
        sellAmount: response.sellAmount,
        profit: response.profit,
        profitPct: response.profitPct,
        explorerUrl: response.explorerUrl,
        timestamp: response.timestamp
      })),
      catchError((error: HttpErrorResponse) => {
        console.error('Ошибка выполнения арбитража:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to execute arbitrage'));
      })
    );
  }

  /**
   * Получение данных для таблицы
   */
  getMarketTableData(symbol: string, type: string = 'all'): Observable<any> {
    return this.http.get(`${this.API_URL.replace('/dex', '')}/market-data/table/${symbol}`, {
      params: new HttpParams().set('type', type)
    }).pipe(
      timeout(this.TIMEOUT),
      catchError((error: HttpErrorResponse) => {
        console.error('Ошибка загрузки таблицы:', error);
        return of({
          symbol: symbol,
          cex: { prices: [], count: 0, exchanges: [] },
          dex: { spreads: [], count: 0, opportunities: 0 },
          timestamp: Date.now(),
          type: type
        });
      })
    );
  }
}
