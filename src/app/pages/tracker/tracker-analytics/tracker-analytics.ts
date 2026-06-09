import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
  selector: 'app-tracker-analytics',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './tracker-analytics.html',
  styleUrls: ['./tracker-analytics.scss']
})
export class TrackerAnalytics {
  // Входные данные
  categoryDistribution = input<{ slug: string; color: string; minutes: number }[]>([]);
  totalMinutes = input<number>(0);
  selectedProject = input<string | null>(null);

  // События
  stateChange = output<string>();
  formReset = output<void>();

  // Оптимизированные расчеты для графика
  readonly projectSummaries = computed(() => {
    const data = this.categoryDistribution();
    const total = this.totalMinutes();
    if (!data.length || total === 0) return [];

    let currentOffset = 0;
    return [...data]
      .sort((a, b) => b.minutes - a.minutes)
      .map(cat => {
        const percentage = (cat.minutes / total) * 100;
        const res = {
          name: cat.slug,
          minutes: cat.minutes,
          color: cat.color || '#64748b',
          percentage,
          offset: currentOffset
        };
        currentOffset += percentage;
        return res;
      });
  });

  readonly selectedProjectInfo = computed(() => {
    const slug = this.selectedProject();
    return this.projectSummaries().find(p => p.name === slug) || null;
  });

  formatDuration(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}ч ${m}м` : `${m}м`;
  }
}
