import {Component, inject, OnInit, signal, OnDestroy} from '@angular/core';
import {AuthService} from '../../core/auth/auth.service';
import {ExchangePrice, ExchangeSpread} from '../../core/models/crypto.model';
import {CommonModule, DecimalPipe} from '@angular/common';
import {FormsModule} from '@angular/forms'; // Добавляем для ngModel
import {CryptoDataService} from '../../core/services/crypto-data.service';
import {Subject, switchMap, takeUntil, timer, tap} from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  // Добавляем FormsModule в импорты
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private readonly cryptoService = inject(CryptoDataService);

  private readonly destroy$ = new Subject<void>();
  // Оставляем только один поток для управления сменой символа
  private readonly selectedSymbol$ = new Subject<string>();

  supportedCoins: { symbol: string, fullName: string }[] = [];
  selectedCoinSymbol: string = 'BTC';
  topSpreads = signal<ExchangeSpread[]>([]);

  prices = signal<ExchangePrice[]>([]);
  lastUpdatedTime: Date = new Date();

  ngOnInit() {
    this.cryptoService.getCoins().subscribe(list => {
      const sorted = [...list].sort((a, b) => a.symbol.localeCompare(b.symbol));
      this.supportedCoins = sorted;

      if (sorted.length > 0) {
        this.initPriceStream();
        this.onCoinChange();
      }
      timer(0, 15000)
        .pipe(
          switchMap(() => this.cryptoService.getGlobalSpreads()),
          takeUntil(this.destroy$)
        )
        .subscribe(data => {
          const highProfitSpreads = data
            .filter(spread => spread.spreadPct >= 1 && spread.buy.price > 0)
            .sort((a, b) => b.spreadPct - a.spreadPct)
            .slice(0, 15);

          this.topSpreads.set(highProfitSpreads);
        });
    });
  }

  private initPriceStream() {
    this.selectedSymbol$.pipe(
      tap(() => this.prices.set([])),
      switchMap(symbol =>
        timer(0, 10000).pipe(
          switchMap(() => this.cryptoService.getPrices(symbol))
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(data => {
      this.prices.set(data);
      this.lastUpdatedTime = new Date();
    });
  }

  onCoinChange() {
    // Вызываем next у того же Subject, который описан в конвейере выше
    this.selectedSymbol$.next(this.selectedCoinSymbol);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get filteredPrices(): ExchangePrice[] {
    const list = this.prices()
      .filter(ex => ex.ask > 0 && ex.bid > 0);

    // Предварительно считаем maxSpread для каждой строки
    const spreads = new Map<string, number>();

    for (const row of list) {
      let max = -Infinity;

      for (const col of list) {
        if (row.name === col.name) continue;

        const diff = this.calculateDiff(row.ask, col.bid);
        if (diff !== null && diff > max) {
          max = diff;
        }
      }

      spreads.set(row.name, max);
    }

    // Сортировка по убыванию максимального спреда
    return list.sort((a, b) => (spreads.get(b.name)! - spreads.get(a.name)!));
  }

  calculateDiff(buyPrice: number, sellPrice: number): number | null {
    if (!buyPrice || !sellPrice || buyPrice === 0) return null;

    // Реальный спред: (ЦенаПродажи - ЦенаПокупки) / ЦенаПокупки * 100
    const diff = ((sellPrice - buyPrice) / buyPrice) * 100;
    return diff;
  }

  get ribbonDuration(): string {
    const count = this.topSpreads().length;
    return count > 0 ? '30s' : '0s';
  }

  onLogout() {
    this.authService.logout().subscribe({
      next: () => console.log('Сессия завершена!'),
      error: (err) => console.error('Ошибка выхода:', err),
    });
  }
}
