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
      <div class="subtask-row" [routerLink]="['/tasks', 'edit', node.task.id]">
        <div class="subtask-title">
          @if (node.task.parentTaskId) {
            <i class="material-icons sub-icon">subdirectory_arrow_right</i>
          }
          {{ node.task.title }}
        </div>
        <div class="subtask-assignee">
          {{ (node.task.assigneeNames && node.task.assigneeNames.length > 0)
          ? node.task.assigneeNames + ', '
          : '—' }}
        </div>
        <div class="subtask-due">{{ (node.task.dueDate | date:'dd.MM.yyyy') || '—' }}</div>
        <i class="material-icons chevron">chevron_right</i>
      </div>
      @if (node.subtasks && node.subtasks.length) {
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
      grid-template-columns: 1fr 180px 100px 32px;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      cursor: pointer;
      transition: background 0.2s;
    }
    .subtask-row:hover {
      background: rgba(59, 130, 246, 0.05);
    }
    .subtask-title {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .sub-icon {
      font-size: 16px;
      color: #3b82f6;
    }
    .subtask-assignee, .subtask-due {
      font-size: 0.8rem;
      color: #9ca3af;
    }
    .chevron {
      color: #9ca3af;
      font-size: 1.2rem;
      justify-self: end;
    }
    .subtask-children {
      margin-left: 24px;
      border-left: 1px dashed rgba(255,255,255,0.15);
    }
    @media (max-width: 768px) {
      .subtask-row {
        grid-template-columns: 1fr 32px;
      }
      .subtask-assignee, .subtask-due {
        display: none;
      }
    }
  `]
})
export class SubtaskTreeComponent {
  @Input({ required: true }) node!: TaskTreeRO;
}
