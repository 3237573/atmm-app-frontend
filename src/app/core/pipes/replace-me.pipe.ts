import { Pipe, PipeTransform, inject } from '@angular/core';
import {AuthService} from '../services/auth.service';


@Pipe({
  name: 'replaceMe',
  standalone: true
})
export class ReplaceMePipe implements PipeTransform {
  private readonly authService = inject(AuthService);

  transform(value: string | string[] | undefined): string {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return 'Не назначен';
    }

    // Получаем имя текущего пользователя из твоего AuthService
    const currentUser = this.authService.currentUser();
    const currentUserName = currentUser?.displayName || currentUser?.fullName || '';

    // Приводим к массиву строк для удобной обработки
    const namesArray = Array.isArray(value)
      ? value
      : value.split(',').map(n => n.trim());

    // Если имя совпадает с текущим пользователем — меняем на «Я»
    return namesArray
      .map(name => (name === currentUserName && currentUserName !== '') ? 'Я' : name)
      .join(', ');
  }
}
