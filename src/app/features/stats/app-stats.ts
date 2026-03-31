import { Component, Input } from '@angular/core';
import { AppStatDTO } from '../../core/models/activity.model';

@Component({
  selector: 'app-stats-table',
  templateUrl: './app-stats.html',
  styleUrls: ['./app-stats.scss']
})
export class AppStatsComponent {
  _stats: AppStatDTO[] = [];

  @Input() set stats(value: any[] | undefined) {
    console.log('1. Данные пришли в таблицу:', value);

    if (!value || !Array.isArray(value) || value.length === 0) {
      this._stats = [];
      return;
    }

    // Группировка данных (схлопываем дубликаты)
    const grouped = value.reduce((acc: Record<string, AppStatDTO>, curr: any) => {
      // Пытаемся достать имя (поддерживаем оба формата: из логов и из DTO)
      const name = curr.projectName || curr.name || 'Unknown';

      if (!acc[name]) {
        acc[name] = {
          name: name,
          minutes: 0,
          color: curr.color || '#64748b',
          categorySlug: curr.categorySlug || 'other'
        };
      }

      // КРИТИЧНО: Проверяем все возможные имена поля с минутами
      const mins = curr.durationMinutes || curr.minutes || 0;
      acc[name].minutes += mins;

      return acc;
    }, {});

    // Превращаем в массив и сортируем: самые долгие сверху
    this._stats = Object.values(grouped).sort((a, b) => b.minutes - a.minutes);

    console.log('2. Итог после обработки (проверь поле minutes тут):', this._stats);
  }

  formatTime(totalMinutes: number | undefined): string {
    // Если пришло 0 или undefined
    if (!totalMinutes || isNaN(totalMinutes)) return '0м';

    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);

    if (h > 0) {
      return `${h}ч ${m > 0 ? m + 'м' : ''}`;
    }
    return `${m}м`;
  }
}
