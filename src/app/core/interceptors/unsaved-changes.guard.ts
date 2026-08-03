import { CanDeactivateFn } from '@angular/router';
import { TaskDetail } from '@features/task/task-detail/task-detail';

export const unsavedChangesGuard: CanDeactivateFn<TaskDetail> = (component) => {
  return component.canDeactivate();
};
