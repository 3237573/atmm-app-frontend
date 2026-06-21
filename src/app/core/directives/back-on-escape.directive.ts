import {Directive, HostListener, inject, input} from '@angular/core';
import {NavigationService} from '../services/navigation.service';
import {ComponentDeactivateService} from '../services/component-deactivate.service';
import {TranslocoService} from '@ngneat/transloco';

@Directive({
  selector: '[appBackOnEscape]',
  standalone: true
})
export class BackOnEscapeDirective {
  private readonly navService = inject(NavigationService);
  private readonly deactivateService = inject(ComponentDeactivateService);
  private readonly translocoService = inject(TranslocoService); // Внедряем сервис переводов

  fallback = input<string>('/tasks');

  @HostListener('document:keydown.escape', ['$event'])
  async onEscape(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    const target = keyboardEvent.target as HTMLElement;

    // Игнорируем нажатие, если пользователь пишет в инпутах
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
      return;
    }

    // Проверяем несохраненные изменения на самой странице
    const canLeave = await this.deactivateService.checkDeactivation();
    if (!canLeave) return;

    // ЕСЛИ возвращаемся на страницу логина -> спрашиваем подтверждение
    if (this.fallback() === '/login') {
      const confirmMsg = this.translocoService.translate('auth.logoutConfirmation') || 'Вы уверены, что хотите выйти из системы?';
      if (!confirm(confirmMsg)) {
        return; // Отменяем выход, если пользователь нажал "Отмена"
      }
    }

    this.navService.back(this.fallback());
  }
}
