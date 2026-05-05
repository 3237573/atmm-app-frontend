import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TaskTreeRO } from '../../../core/models/task/task.model';

@Component({
  selector: 'app-subtask-tree',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="subtask-node">
      <div class="subtask-item" [routerLink]="['/tasks', node.task.id]">
        <span class="status-dot" [class]="node.task.status.toLowerCase()"></span>
        <span class="subtask-title">{{ node.task.title }}</span>
        <span class="subtask-assignee">{{ node.task.assigneeName || 'Не назначен' }}</span>
        <i class="material-icons chevron">chevron_right</i>
      </div>

      @if (node.subtasks && node.subtasks.length > 0) {
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

    .subtask-item {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255,255,255, 0.05); // Подгони под свой $border
      cursor: pointer;
      transition: background 0.2s;
      gap: 1rem;

      &:hover {
        background: rgba(59, 130, 246, 0.05); // $accent hover
      }
    }

    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;

      &.completed { background: #10b981; } // $success
      &.pending { background: #f59e0b; } // $warning
      &.in_progress { background: #3b82f6; } // $accent
      &.review { background: #a855f7; }
    }

    .subtask-title {
      flex: 1;
      font-size: 0.95rem;
      font-weight: 500;
    }

    .subtask-assignee {
      font-size: 0.8rem;
      color: #9ca3af; // $text-muted
    }

    .chevron {
      color: #9ca3af;
      font-size: 1.2rem;
    }

    /* Магия иерархии - лесенка для вложенных задач */
    .subtask-children {
      margin-left: 24px;
      border-left: 1px dashed rgba(255,255,255, 0.15);
    }
  `]
})
export class SubtaskTreeComponent {
  @Input({ required: true }) node!: TaskTreeRO;
}
