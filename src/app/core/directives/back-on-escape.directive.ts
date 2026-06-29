import { Directive, HostListener, inject, input } from '@angular/core';
import { NavigationService } from '../services/navigation.service';
import { ComponentDeactivateService } from '../services/component-deactivate.service';

@Directive({
  selector: '[appBackOnEscape]',
  standalone: true
})
export class BackOnEscapeDirective {
  private readonly navService = inject(NavigationService);
  private readonly deactivateService = inject(ComponentDeactivateService);

  fallback = input<string>('/tasks');

  @HostListener('document:keyup.escape', ['$event'])
  async onEscape(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    const target = keyboardEvent.target as HTMLElement;

    // Игнорируем нажатие, если пользователь пишет в инпутах
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
      return;
    }

    keyboardEvent.preventDefault();
    keyboardEvent.stopImmediatePropagation();

    // Проверяем несохраненные изменения (например, в формах тасок)
    const canLeave = await this.deactivateService.checkDeactivation();
    if (!canLeave) return;

    // Просто вызываем метод back. Сервис сам поймет, куда ведет этот шаг,
    // и если там логин — автоматически покажет confirm().
    this.navService.back(this.fallback());
  }
}
