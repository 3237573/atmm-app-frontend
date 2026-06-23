import {inject, Pipe, PipeTransform} from '@angular/core';
import {AuthService} from '../services/auth.service';
import {TranslocoService} from '@ngneat/transloco';

@Pipe({
  name: 'replaceMe',
  standalone: true
})
export class ReplaceMePipe implements PipeTransform {
  private readonly authService = inject(AuthService);
  private readonly translocoService = inject(TranslocoService);

  transform(value: string | string[] | undefined): string {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return this.translocoService.translate('member.notAssigned');
    }

    // Get the name of the current user from your AuthService
    const currentUser = this.authService.currentUser();
    const currentUserName = currentUser?.displayName || currentUser?.fullName || '';

    // Cast to an array of strings for easy processing
    const namesArray = Array.isArray(value)
      ? value
      : value.split(',').map(n => n.trim());

    // If the name is the same as the current user, change it to "I'm"
    return namesArray
      .map(name => (name === currentUserName && currentUserName !== '') ? this.translocoService.translate('member.iAm') : name)
      .join(', ');
  }
}
