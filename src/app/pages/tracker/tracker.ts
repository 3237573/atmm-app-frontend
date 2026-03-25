import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivityService, UserActivityReport } from '../../core/services/activity.service';

// --- Чистые функции (Вне компонента для скорости) ---

const FIXED_COLORS: Record<string, string> = {
  'Web Browsing': '#ea4335',
  'Idle / Away': '#4b5563',
  'Communication': '#0088cc',
  'Database Management': '#336791',
  'Terminal': '#22c55e',
  'Default': '#5594de'
};

function getProjectColor(projectName: string): string {
  if (FIXED_COLORS[projectName]) return FIXED_COLORS[projectName];
  let hash = 0;
  for (let i = 0; i < projectName.length; i++) {
    hash = projectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash % 360)}, 65%, 55%)`;
}

function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tracker.html',
  styleUrl: './tracker.scss'
})
export class Tracker implements OnInit, OnDestroy {
  private readonly activityService = inject(ActivityService);

  readonly hours = Array.from({ length: 24 }, (_, i) => i);

  // Состояние
  private readonly report = signal<UserActivityReport | null>(null);
  readonly selectedProject = signal<string | null>(null);
  readonly currentTimeInMinutes = signal(0);
  private timerId?: any;

  // --- Computed свойства ---

  readonly totalMinutes = computed(() => this.report()?.totalActiveMinutes || 0);

  readonly processedActivities = computed(() => {
    const data = this.report();
    return (data?.intervals || []).map(int => ({
      start: isoToMinutes(int.startTime),
      end: isoToMinutes(int.endTime),
      projectName: int.projectName,
      color: getProjectColor(int.projectName)
    }));
  });

  readonly projectSummaries = computed(() => {
    const data = this.report();
    const total = this.totalMinutes();
    if (!data || total === 0) return [];

    let currentOffset = 0;
    return Object.entries(data.projectDistribution)
      .sort(([, a], [, b]) => b - a)
      .map(([name, mins]) => {
        const percentage = (mins / total) * 100;
        const res = {
          name,
          minutes: mins,
          color: getProjectColor(name),
          percentage,
          offset: currentOffset
        };
        currentOffset += percentage;
        return res;
      });
  });

  // --- Методы ---

  ngOnInit() {
    this.refreshData();
    this.updateClock();
    this.timerId = setInterval(() => {
      this.updateClock();
      this.refreshData();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.timerId) clearInterval(this.timerId);
  }

  refreshData() {
    const today = new Date().toISOString().split('T')[0];
    this.activityService.getDailyReport(today).subscribe(data => this.report.set(data));
  }

  // --- Методы управления временем ---

  private updateClock() {
    const now = new Date();
    this.currentTimeInMinutes.set(now.getHours() * 60 + now.getMinutes());
  }

  toggleProject(name: string) {
    this.selectedProject.update(current => current === name ? null : name);
  }

  getStyle(start: number, end: number) {
    const width = Math.max(((end - start) / 1440) * 100, 0.1);
    return {
      'left.%': (start / 1440) * 100,
      'width.%': width
    };
  }

  formatTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  formatDuration(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return h > 0 ? `${h}ч ${m}м` : `${m}м`;
  }

}
