import {Component, inject} from '@angular/core';
import {AuthService} from '../../core/auth/auth.service';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [],
  templateUrl: './tracker.html',
  styleUrl: './tracker.scss',
})
export class Tracker {
  private readonly authService = inject(AuthService);


  onLogout() {
    this.authService.logout().subscribe();
  }
}
