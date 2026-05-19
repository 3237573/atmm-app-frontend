import {Component, Input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {TaskTreeRO} from '../../../core/models/task/task.model';
import {ReplaceMePipe} from '../../../core/pipes/replace-me.pipe';

@Component({
  selector: 'app-subtask-tree',
  standalone: true,
  imports: [CommonModule, RouterModule, ReplaceMePipe],
  template: `
    <div class="subtask-node">
      <div class="subtask-row" [routerLink]="['/tasks', 'edit', node.task.id]">
        <div class="subtask-title">
          @if (node.subtasks && node.subtasks.length) {
            <span class="toggle-icon" (click)="toggleExpand($event)" [class.expanded]="isExpanded()">
              <i class="material-icons">chevron_right</i>
            </span>
          } @else {
            <span class="icon-placeholder"></span>
          }

          <span class="title-text">{{ node.task.title }}</span>
        </div>

        <div class="subtask-assignee">
          {{this.node.task.assigneeNames | replaceMe }}
        </div>

        <div class="subtask-due">{{ (node.task.dueDate | date:'dd.MM.yyyy') || '—' }}</div>
        <i class="material-icons chevron">chevron_right</i>
      </div>

      @if (node.subtasks && node.subtasks.length && isExpanded()) {
        <div class="subtask-children">
          @for (child of node.subtasks; track child.task.id) {
            <app-subtask-tree [node]="child"></app-subtask-tree>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .subtask-node {
      display: flex;
      flex-direction: column;
    }

    .subtask-row {
      display: grid;
      /* Сохраняем вашу сетку колонок */
      grid-template-columns: 1fr 180px 100px 32px;
      align-items: center;
      gap: 0.75rem;

      /* Увеличиваем отступы и задаем min-height, чтобы компенсировать
         двухстрочный текст из блока вложений */
      padding: 0.85rem 1rem;
      min-height: 54px;
      box-sizing: border-box;

      /* Мягкая разделительная линия, как между файлами */
      border-bottom: 1px solid rgba(var(--border), 0.4);
      cursor: pointer;
      transition: background 0.2s ease-in-out;
    }

    .subtask-row:hover {
      /* Легкий подсвет при наведении в тон вашему акценту */
      background: rgba(var(--accent-rgb), 0.04);
    }

    .subtask-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--text-main);
    }

    .subtask-assignee, .subtask-due {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .chevron {
      font-size: 1.2rem;
      color: var(--text-muted);
      justify-self: end;
      transition: transform 0.2s;
    }

    .subtask-row:hover .chevron {
      color: var(--accent);
    }

    .subtask-children {
      padding-left: 1.5rem; /* Смещение для вложенных подзадач */
      border-left: 1px dashed rgba(var(--border), 0.3);
      margin-left: 1.5rem;
    }
  `]
})
export class SubtaskTreeComponent {
  @Input({ required: true }) node!: TaskTreeRO;

  isExpanded = signal<boolean>(false);

  toggleExpand(event: Event): void {
    // Important: prevent the event from popping up so that clicking on the arrow does not trigger [routerLink]
    event.stopPropagation();
    event.preventDefault();

    this.isExpanded.update(expanded => !expanded);
  }

}
