import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ExchangePrice } from '../../core/models/crypto.model';
import { CommonModule, DecimalPipe } from '@angular/common';
import { CryptoDataService } from '../../core/services/crypto-data.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  public authService = inject(AuthService);
  private cryptoService = inject(CryptoDataService);
  
  prices = signal<ExchangePrice[]>([]);

  ngOnInit() {
    // Запускаем бесконечный поток обновлений
    this.cryptoService.getLivePrices(10000).subscribe({
      next: (data) => {
        this.prices.set(data); 
      },
      error: (err) => console.error('Ошибка монитора:', err)
    });
  }
  
  getBgColor(diff: number | null): string {
    if (diff === null || Math.abs(diff) < 0.01) return 'transparent';
    if (diff > 0) return `rgba(0, 255, 0, ${Math.min(Math.abs(diff), 0.5)})`; // Зеленый для роста
    return `rgba(255, 0, 0, ${Math.min(Math.abs(diff), 0.5)})`; // Красный для падения
  }

  calculateDiff(rowPrice: number, colPrice: number): number | null {
    if (rowPrice === 0 || colPrice === 0) return null;
    return ((rowPrice - colPrice) / colPrice) * 100;
  }

  calculatePriceDiff(p1: number, p2: number): number {
  return p1 - p2; // Разница в валюте
}

  onLogout() {
    this.authService.logout().subscribe({
      next: () => {
        console.log('Сессия завершена!');
      },
      error: (err) => console.error('Ошибка выхода:', err),
    });
  }
}
