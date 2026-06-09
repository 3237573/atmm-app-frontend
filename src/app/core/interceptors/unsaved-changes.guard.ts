import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { TaskDetail } from '@features/task/task-detail/task-detail';

@Injectable({ providedIn: 'root' })
export class UnsavedChangesGuard implements CanDeactivate<TaskDetail> {
  canDeactivate(component: TaskDetail): boolean {
    return component.canDeactivate();
  }
}
