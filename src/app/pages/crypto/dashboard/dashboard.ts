import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {AuthService} from '../../../core/auth/auth.service';
import {ExchangePrice, ExchangeSpread} from '../../../core/models/crypto.model';
import {CommonModule, DecimalPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CryptoDataService} from '../../../core/services/crypto/crypto-data.service';
import {catchError, of, Subject, switchMap, takeUntil, tap, timer} from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  // For private using
  private readonly authService = inject(AuthService);
  private readonly cryptoService = inject(CryptoDataService);
  private readonly destroy$ = new Subject<void>();
  private readonly selectedSymbol$ = new Subject<string>();

  // For template using
  public isLoading = signal<boolean>(false);
  public selectedCoinSymbol: string = 'BTC';
  public topSpreads = signal<ExchangeSpread[]>([]);
  public prices = signal<ExchangePrice[]>([]);
  supportedCoins: { symbol: string; fullName: string }[] = [];
  lastUpdatedTime: Date = new Date();

  // OPTIMIZATION: Calculate the sorted list only when prices change
  readonly filteredPrices = computed(() => {
    const currentPrices = this.prices().filter(ex => ex.ask > 0 && ex.bid > 0);
    if (currentPrices.length < 2) return currentPrices;

    const spreadWeights = new Map<string, number>();

    for (const row of currentPrices) {
      let maxSpread = -Infinity;
      for (const col of currentPrices) {
        if (row.name === col.name) continue;
        const diff = ((col.bid - row.ask) / row.ask) * 100;
        if (diff > maxSpread) maxSpread = diff;
      }
      spreadWeights.set(row.name, maxSpread);
    }

    return [...currentPrices].sort((a, b) =>
      (spreadWeights.get(b.name) ?? 0) - (spreadWeights.get(a.name) ?? 0)
    );
  });

  ngOnInit() {
    this.cryptoService.getCoins().pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.supportedCoins = [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));

      if (this.supportedCoins.length > 0) {
        this.initPriceStream();
        this.selectCoin(this.selectedCoinSymbol);
      }

      // Поток глобальных спредов (лента сверху)
      timer(0, 15000)
        .pipe(
          switchMap(() => this.cryptoService.getGlobalSpreads().pipe(
            catchError(err => {
              console.error('Ошибка ленты спредов:', err);
              return of([]);
            })
          )),
          takeUntil(this.destroy$)
        )
        .subscribe(data => {
          const highProfit = data
            .filter(s => s.spreadPct >= 1 && s.buy.price > 0)
            .sort((a, b) => b.spreadPct - a.spreadPct)
            .slice(0, 15);
          this.topSpreads.set(highProfit);
        });
    });
  }

  private initPriceStream() {
    this.selectedSymbol$.pipe(
      tap(() => {
        this.isLoading.set(true);
        this.prices.set([])
      }), // Сброс таблицы при смене монеты
      switchMap(symbol =>
        timer(0, 10000).pipe(
          switchMap(() => this.cryptoService.getPrices(symbol).pipe(
            catchError(err => {
              this.isLoading.set(false);
              console.error(`Ошибка загрузки цен для ${symbol}:`, err);
              return of(this.prices()); // Возвращаем старые цены при ошибке
            })
          ))
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      if (data.length > 0) {
        this.prices.set(data);
        this.isLoading.set(false);
        this.lastUpdatedTime = new Date();
      }
    });
  }

  selectCoin(symbol?: string) {
    if (symbol) {
      this.selectedCoinSymbol = symbol;
    }
    // Уведомляем RxJS поток о необходимости смены подписки на API
    this.selectedSymbol$.next(this.selectedCoinSymbol);
  }


  calculateDiff(buyPrice: number, sellPrice: number): number | null {
    if (!buyPrice || !sellPrice || buyPrice === 0) return null;
    return ((sellPrice - buyPrice) / buyPrice) * 100;
  }

  get ribbonDuration(): string {
    return this.topSpreads().length > 0 ? '25s' : '0s';
  }

  onLogout() {
    this.authService.logout().subscribe();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
