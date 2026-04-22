import {Component, computed, inject, OnInit} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemberService } from '../../core/services/member/member.service';
import { MemberResponse } from '../../core/models/member.model';
import { Router } from '@angular/router';
import {FormsModule} from '@angular/forms';
import {AuthService} from '../../core/auth/auth.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members.html',
  styleUrl: './members.scss'
})
export class Members implements OnInit {
  private readonly authService = inject(AuthService);
  members: MemberResponse[] = [];
  loading = true;

  showInviteForm = false;
  inviteData = { email: '', password: '', roleName: 'MEMBER' };
  isSubmitting = false;

  canManage = computed(() => this.authService.hasPermission('tracker.manage'));

  constructor(
    private readonly memberService: MemberService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadMembers()
  }

  viewActivity(userId: string) {
    // Переход на страницу трекера с ID пользователя
    this.router.navigate(['/tracker'], { queryParams: { userId: userId } });
  }

  loadMembers(): void {
    this.loading = true;
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Ошибка загрузки сотрудников', err);
        this.loading = false;
      }
    });
  }

  toggleInviteForm() {
    this.showInviteForm = !this.showInviteForm;
  }

  // members.ts

  onInvite() {
    if (!this.inviteData.email || !this.inviteData.password) return;

    this.isSubmitting = true;
    // Добавляем третий аргумент — пароль
    this.memberService.inviteMember(
      this.inviteData.email,
      this.inviteData.roleName,
      this.inviteData.password
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.showInviteForm = false;
        this.inviteData = { email: '', password: '', roleName: 'MEMBER' }; // Очищаем всё
        this.loadMembers();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(err.error?.error || 'Ошибка при приглашении');
      }
    });
  }

// Метод для удаления (с подтверждением)
  deleteMember(userId: string) {
    if (confirm('Вы уверены, что хотите исключить сотрудника?')) {
      this.memberService.removeMember(userId).subscribe({
        next: () => this.loadMembers(),
        error: (err) => alert(err.error?.error || 'Ошибка удаления')
      });
    }
  }

}
