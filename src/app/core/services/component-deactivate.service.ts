import { Injectable } from '@angular/core';
import { CanComponentDeactivate } from '../interfaces/can-deactivate.interface';

@Injectable({ providedIn: 'root' })
export class ComponentDeactivateService {
  private currentComponent: CanComponentDeactivate | null = null;

  register(component: CanComponentDeactivate): void {
    this.currentComponent = component;
  }

  unregister(): void {
    this.currentComponent = null;
  }

  async checkDeactivation(): Promise<boolean> {
    if (!this.currentComponent) return true;
    const result = this.currentComponent.canDeactivate();
    if (result instanceof Promise) {
      return await result;
    }
    return result;
  }
}
