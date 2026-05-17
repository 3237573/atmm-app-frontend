import { Directive, HostListener, inject, input } from '@angular/core';
import { NavigationService } from '../services/navigation.service';

@Directive({
  selector: '[appBackOnEscape]',
  standalone: true
})
export class BackOnEscapeDirective {
  private readonly navService = inject(NavigationService);
  fallback = input<string>('/tasks');

  // Указываем тип KeyboardEvent здесь
  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: any) { // Используем any или Event, чтобы избежать конфликта на входе
    const keyboardEvent = event as KeyboardEvent; // Принудительно приводим к KeyboardEvent

    const target = keyboardEvent.target as HTMLElement;

    // Теперь ошибки не будет, так как мы работаем с типизированным target
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
      return;
    }

    this.navService.back(this.fallback());
  }
}
