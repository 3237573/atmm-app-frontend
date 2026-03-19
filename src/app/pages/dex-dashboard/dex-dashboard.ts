import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {interval, Subject, switchMap, takeUntil, tap, finalize, Observable} from 'rxjs';

// ✅ Правильные импорты
import {DexSpreadService, Web3WalletService} from '../../core/services';
import {DexNetwork, DexSpread, ArbitrageResult, WalletInfo} from '../../core/models';

@Component({
  selector: 'app-dex-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dex-dashboard.html',
  styleUrls: ['./dex-dashboard.scss']
})
export class DexDashboard implements OnInit, OnDestroy {
  private readonly dexService = inject(DexSpreadService);
  private readonly walletService = inject(Web3WalletService);
  private readonly destroy$ = new Subject<void>();

  // Состояние
  isLoading = signal<boolean>(false);
  isExecuting = signal<boolean>(false);
  selectedNetwork = signal<string>('all');
  selectedProtocol = signal<string>('all');
  minSpread = signal<number>(1.0);
  minLiquidity = signal<number>(100000);

  spreads = signal<DexSpread[]>([]);
  networks = signal<DexNetwork[]>([]);
  protocols = signal<string[]>([]);

  walletConnected = signal<boolean>(false);
  walletAddress = signal<string>('');
  walletBalance = signal<string>('0');

  // Вычисляемые данные
  readonly filteredSpreads = computed(() => {
    let filtered = this.spreads();

    if (this.selectedNetwork() !== 'all') {
      filtered = filtered.filter(s => s.network === this.selectedNetwork());
    }

    if (this.selectedProtocol() !== 'all') {
      filtered = filtered.filter(s =>
        s.buy.protocol === this.selectedProtocol() ||
        s.sell.protocol === this.selectedProtocol()
      );
    }

    filtered = filtered.filter(s => s.spreadPct >= this.minSpread());

    return filtered.sort((a, b) => b.spreadPct - a.spreadPct);
  });

  ngOnInit() {
    this.loadNetworks();
    this.loadProtocols();
    this.startSpreadsStream();
    this.checkWalletConnection();
  }

  private loadNetworks() {
    this.dexService.getNetworks().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (networks: DexNetwork[]) => this.networks.set(networks),
      error: (err: any) => console.error('Error loading networks:', err)
    });
  }

  private loadProtocols() {
    this.dexService.getProtocols().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (protocols: string[]) => this.protocols.set(protocols),
      error: (err: any) => console.error('Error loading protocols:', err)
    });
  }

  private startSpreadsStream() {
    interval(15000)
      .pipe(
        tap(() => this.isLoading.set(true)),
        switchMap(() => this.dexService.getTopSpreads(50)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (spreads: DexSpread[]) => {
          this.spreads.set(spreads);
          this.isLoading.set(false);
        },
        error: (err: any) => {
          console.error('Error loading spreads:', err);
          this.isLoading.set(false);
        }
      });
  }

  private checkWalletConnection() {
    this.walletService.getWalletInfo().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (wallet: WalletInfo) => {
        this.walletConnected.set(wallet.isConnected);
        this.walletAddress.set(wallet.address);
        this.walletBalance.set(wallet.balance);
      },
      error: (err: any) => console.error('Error checking wallet:', err)
    });
  }

  /**
   * Подключение кошелька (Promise версия)
   */
  async connectWallet(): Promise<void> {
    try {
      const address = await this.walletService.connect();
      this.walletAddress.set(address);
      this.walletConnected.set(true);

      // Обновим баланс
      this.walletService.getWalletInfo().pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (wallet: WalletInfo) => {
          this.walletBalance.set(wallet.balance);
        }
      });

    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      alert(error?.message || 'Failed to connect wallet');
    }
  }

  /**
   * Выполнение арбитража (Observable версия)
   */
  executeArbitrage(spread: DexSpread): void {
    if (!this.walletConnected()) {
      alert('Please connect wallet first');
      return;
    }

    this.isExecuting.set(true);

    this.dexService.executeArbitrage(spread, this.walletAddress()).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isExecuting.set(false))
    ).subscribe({
      next: (result: ArbitrageResult) => {
        // Открываем транзакцию в эксплорере
        if (result.explorerUrl) {
          window.open(result.explorerUrl, '_blank');
        }

        alert(`✅ Arbitrage executed!\n` +
          `Transaction: ${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}\n` +
          `Profit: $${result.profit.toFixed(2)} (${result.profitPct.toFixed(2)}%)`);
      },
      error: (error: any) => {
        console.error('Arbitrage error:', error);
        alert(`❌ Failed: ${error?.message || 'Unknown error'}`);
      }
    });
  }

  /**
   * Альтернатива: если хотите использовать async/await
   */
  async executeArbitrageAsync(spread: DexSpread): Promise<void> {
    if (!this.walletConnected()) {
      alert('Please connect wallet first');
      return;
    }

    this.isExecuting.set(true);

    try {
      // Конвертируем Observable в Promise
      const result = await this.dexService.executeArbitrage(spread, this.walletAddress())
        .pipe(takeUntil(this.destroy$))
        .toPromise();

      if (result) {
        if (result.explorerUrl) {
          window.open(result.explorerUrl, '_blank');
        }

        alert(`✅ Arbitrage executed!\n` +
          `Transaction: ${result.txHash.slice(0, 10)}...${result.txHash.slice(-8)}\n` +
          `Profit: $${result.profit.toFixed(2)} (${result.profitPct.toFixed(2)}%)`);
      }
    } catch (error: any) {
      console.error('Arbitrage error:', error);
      alert(`❌ Failed: ${error?.message || 'Unknown error'}`);
    } finally {
      this.isExecuting.set(false);
    }
  }

  formatPrice(price: number): string {
    if (!price && price !== 0) return 'N/A';
    if (price < 0.001) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    return price.toFixed(0);
  }

  formatLiquidity(liquidity: number | undefined): string {
    if (!liquidity) return 'N/A';
    if (liquidity >= 1e9) return `$${(liquidity / 1e9).toFixed(2)}B`;
    if (liquidity >= 1e6) return `$${(liquidity / 1e6).toFixed(2)}M`;
    if (liquidity >= 1e3) return `$${(liquidity / 1e3).toFixed(2)}K`;
    return `$${liquidity.toFixed(0)}`;
  }

  getSpreadClass(spread: number): string {
    if (spread >= 5) return 'high';
    if (spread >= 2) return 'medium';
    return 'low';
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
