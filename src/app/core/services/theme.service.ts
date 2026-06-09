import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Сигнал для хранения текущей темы
  theme = signal<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
  );

  constructor() {
    // Автоматически обновляем класс у body при изменении сигнала
    effect(() => {
      const current = this.theme();
      document.body.classList.remove('light-theme', 'dark-theme');
      document.body.classList.add(`${current}-theme`);
      localStorage.setItem('theme', current);
    });
  }

  toggleTheme() {
    this.theme.update(t => t === 'light' ? 'dark' : 'light');
  }
}
