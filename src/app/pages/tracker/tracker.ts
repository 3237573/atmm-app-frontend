import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common'; // Добавь DecimalPipe
import {ActivatedRoute, Router} from '@angular/router';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {combineLatest, map, switchMap, tap} from 'rxjs';
import {ActivityService} from '../../core/services/tracker/activity.service';
import {AppStatDTO} from '../../core/models/activity.model';
import {ActivityDetail} from './activity-detail/activity-detail';
import {TrackerAnalytics} from './tracker-analytics/tracker-analytics';

export interface UserActivityReportV2 {
  userId: string;
  date: string;
  totalActiveMinutes: number;
  intervals: any[];
  projectDistributionList: AppStatDTO[]; // То самое поле
  categoryDistribution: { slug: string; color: string; minutes: number }[];
}

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, ActivityDetail, TrackerAnalytics],
  templateUrl: './tracker.html',
  styleUrl: './tracker.scss'
})
export class Tracker implements OnInit, OnDestroy {
  private readonly activityService = inject(ActivityService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly selectedDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly targetUserId = signal<string | null>(null);
  readonly selectedProject = signal<string | null>(null);
  readonly currentTimeInMinutes = signal(0);
  readonly loading = signal(true);

  private timerId?: any;
  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  // Используем Pipe для явного указания типа данных
  private readonly report$ = combineLatest([
    toObservable(this.selectedDate),
    toObservable(this.targetUserId)
  ]).pipe(
    tap(() => {
      this.loading.set(true);
      this.selectedProject.set(null);
    }),
    switchMap(([date, userId]) =>
      this.activityService.getReport(date, userId ?? undefined)
    ),
    // Явно приводим тип, чтобы Angular не путался
    map(data => data as UserActivityReportV2),
    tap(() => this.loading.set(false))
  );

  readonly report = toSignal(this.report$);
  readonly totalMinutes = computed(() => this.report()?.totalActiveMinutes || 0);
  readonly isToday = computed(() => this.selectedDate() === new Date().toISOString().split('T')[0]);

  // Внутри класса Tracker добавь:
  readonly selectedProjectInfo = computed(() => {
    const slug = this.selectedProject();
    if (!slug) return null;
    return this.projectSummaries().find(p => p.name === slug);
  });

  // Оптимизированная логика для бублика + СОРТИРОВКА
  readonly projectSummaries = computed(() => {
    const data = this.report();
    const total = this.totalMinutes();
    if (!data || total === 0) return [];

    // 1. Сортируем категории по убыванию времени
    const sortedCategories = [...(data.categoryDistribution || [])]
      .sort((a, b) => b.minutes - a.minutes);

    let currentOffset = 0;
    return sortedCategories.map(cat => {
      const percentage = (cat.minutes / total) * 100;
      const res = {
        name: cat.slug,
        minutes: cat.minutes,
        color: cat.color || '#64748b',
        percentage: percentage,
        offset: currentOffset // Офсет считается уже по отсортированным данным
      };
      currentOffset += percentage;
      return res;
    });
  });

  readonly processedActivities = computed(() => {
    const data = this.report();
    return (data?.intervals || []).map(int => {
      const start = this.isoToMinutes(int.startTime);
      const end = this.isoToMinutes(int.endTime);
      return {
        ...int, start, end,
        style: {
          'left.%': (start / 1440) * 100,
          'width.%': Math.max(((end - start) / 1440) * 100, 0.2)
        }
      };
    });
  });

  ngOnInit() {
    this.route.queryParamMap.subscribe(params => this.targetUserId.set(params.get('userId')));
    this.updateClock();
    this.timerId = setInterval(() => this.updateClock(), 60000);
  }

  ngOnDestroy() { if (this.timerId) clearInterval(this.timerId); }

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

  toggleProject(slug: string) {
    this.selectedProject.update(curr => curr === slug ? null : slug);
  }

  formatTime(mins: number): string {
    return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
  }

  formatDuration(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}ч ${m}м` : `${m}м`;
  }

  private updateClock() {
    const now = new Date();
    this.currentTimeInMinutes.set(now.getHours() * 60 + now.getMinutes());
  }

  private isoToMinutes(iso: string): number {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  }
}
