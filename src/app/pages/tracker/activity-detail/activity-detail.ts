import {Component, input, output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslocoPipe} from '@ngneat/transloco';
import {AppStatDTO} from '../../../core/models/activity.model';

@Component({
  selector: 'app-activity-detail',
  standalone: true,
  // Если ты оставил пайп в HTML, оставь его и тут. Если убрал из HTML — удали отсюда.
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './activity-detail.html',
  styleUrl: './activity-detail.scss'
})
export class ActivityDetail {
  items = input<AppStatDTO[]>([]);
  selectedProject = input<string | null>(null);
  toggle = output<string>();

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}ч ${m}м` : `${m}м`;
  }
}
