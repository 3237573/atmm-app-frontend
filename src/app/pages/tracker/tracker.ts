import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap, combineLatest, delay } from 'rxjs';
import { ActivityService, UserActivityReport } from '../../core/services/activity.service';

const FIXED_COLORS: Record<string, string> = {
  'Idle / Away': '#4b5563',
  'Web Browsing': '#4285f4',
  'Terminal': '#22c55e',
  'Communication': '#24a1de',
  'Database Management': '#336791',
  'API Testing': '#ff6c37',
  'Default': '#6366f1'
};

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracker.html',
  styleUrl: './tracker.scss'
})
export class Tracker implements OnInit, OnDestroy {
  private readonly activityService = inject(ActivityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // --- Состояние (Signals) ---
  readonly selectedDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly targetUserId = signal<string | null>(null);
  readonly selectedProject = signal<string | null>(null);
  readonly currentTimeInMinutes = signal(0);
  readonly loading = signal(true);

  private timerId?: any;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  // --- Реактивный поток данных ---
  private readonly report$ = combineLatest([
    toObservable(this.selectedDate),
    toObservable(this.targetUserId)
  ]).pipe(
    tap(() => {
      this.loading.set(true);
      this.selectedProject.set(null); // Сбрасываем фильтр при смене данных
    }),
    switchMap(([date, userId]) => this.activityService.getReport(date, userId ?? undefined)),
    tap(() => this.loading.set(false))
  );

  readonly report = toSignal(this.report$);

  // --- Computed свойства ---
  readonly totalMinutes = computed(() => this.report()?.totalActiveMinutes || 0);

  readonly isToday = computed(() =>
    this.selectedDate() === new Date().toISOString().split('T')[0]
  );

  readonly processedActivities = computed(() => {
    const data = this.report();
    return (data?.intervals || []).map(int => {
      const start = this.isoToMinutes(int.startTime);
      const end = this.isoToMinutes(int.endTime);
      return {
        ...int,
        start,
        end,
        color: this.getProjectColor(int.projectName),
        style: {
          'left.%': (start / 1440) * 100,
          'width.%': Math.max(((end - start) / 1440) * 100, 0.2)
        }
      };
    });
  });

  readonly projectSummaries = computed(() => {
    const data = this.report();
    const total = this.totalMinutes();
    if (!data || total === 0) return [];

    const THRESHOLD = 5; // 5 минут
    const entries = Object.entries(data.projectDistribution);

    const majorProjects = entries.filter(([, mins]) => mins >= THRESHOLD);
    const minorMins = entries
      .filter(([, mins]) => mins < THRESHOLD)
      .reduce((sum, [, mins]) => sum + mins, 0);

    let results = majorProjects
      .sort(([, a], [, b]) => b - a)
      .map(([name, mins]) => ({
        name,
        minutes: mins,
        color: this.getProjectColor(name),
        percentage: (mins / total) * 100
      }));

    if (minorMins > 0) {
      results.push({
        name: 'Прочее',
        minutes: minorMins,
        color: '#64748b', // Нейтральный серый
        percentage: (minorMins / total) * 100
      });
    }

    // Считаем offset для SVG
    let currentOffset = 0;
    return results.map(p => {
      const res = { ...p, offset: currentOffset };
      currentOffset += p.percentage;
      return res;
    });
  });

  // --- Инициализация ---
  ngOnInit() {
    // Подхватываем userId из URL, если пришли со страницы Members
    this.route.queryParamMap.subscribe(params => {
      const id = params.get('userId');
      this.targetUserId.set(id);
    });

    this.updateClock();
    this.timerId = setInterval(() => this.updateClock(), 60000);
  }

  ngOnDestroy() {
    if (this.timerId) clearInterval(this.timerId);
  }

  // --- Методы управления ---
  onDateChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    if (val) this.selectedDate.set(val);
  }

  changeDay(delta: number) {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + delta);
    this.selectedDate.set(d.toISOString().split('T')[0]);
  }

  resetToMe() {
    this.router.navigate([], { queryParams: { userId: null }, queryParamsHandling: 'merge' });
    this.targetUserId.set(null);
  }

  toggleProject(name: string) {
    this.selectedProject.update(curr => curr === name ? null : name);
  }

  private updateClock() {
    const now = new Date();
    this.currentTimeInMinutes.set(now.getHours() * 60 + now.getMinutes());
  }

  // --- Хелперы ---
  private getProjectColor(name: string): string {
    if (FIXED_COLORS[name]) return FIXED_COLORS[name];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash % 360)}, 60%, 50%)`;
  }

  private isoToMinutes(iso: string): number {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  }

  formatTime(mins: number): string {
    return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
  }

  formatDuration(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}ч ${m}м` : `${m}м`;
  }
}
