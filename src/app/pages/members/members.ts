import {Component, computed, inject, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MemberService} from '../../core/services/member/member.service';
import {IMemberResponse} from '../../core/models/member.model';
import {Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {AuthService} from '../../core/services/auth/auth.service';

@Component({
  selector: 'app-members',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members.html',
  styleUrl: './members.scss'
})
export class Members implements OnInit {
  private readonly authService = inject(AuthService);
  members: IMemberResponse[] = [];
  loading = true;
  editingMember: IMemberResponse | null = null;
  showEditModal = false;
  searchQuery = '';
  selectedRole = '';
  selectedStatus = '';

  showInviteForm = false;
  inviteData = {
    email: '',
    password: '',
    displayName: '',
    roleName: 'MEMBER'
  };
  isSubmitting = false;

  canManage = computed(() => this.authService.hasPermission('user:update'));

  constructor(
    private readonly memberService: MemberService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadMembers()
  }

  viewActivity(userId: string) {
    this.router.navigate(['/tracker'], { queryParams: { userId: userId } });
  }

  loadMembers(): void {
    this.loading = true;
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members = this.sortMembersByRole(data);
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

  isFormValid(): boolean {
    return !!this.inviteData.email &&
      !!this.inviteData.password &&
      this.inviteData.password.length >= 6 &&
      !!this.inviteData.displayName &&  // 👈 displayName обязателен
      this.inviteData.displayName.trim().length > 0;
  }

  onInvite() {
    if (!this.isFormValid()) return;

    this.isSubmitting = true;

    this.memberService.inviteMember(
      this.inviteData.email,
      this.inviteData.roleName,
      this.inviteData.password,
      this.inviteData.displayName
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.showInviteForm = false;
        this.inviteData = { email: '', password: '', displayName: '', roleName: 'MEMBER' };
        this.loadMembers();
      },
      error: (err) => {
        this.isSubmitting = false;
        alert(err.error?.error || 'Ошибка при приглашении');
      }
    });
  }

  deleteMember(userId: string) {
    if (confirm('Вы уверены, что хотите исключить сотрудника?')) {
      this.memberService.removeMember(userId).subscribe({
        next: () => this.loadMembers(),
        error: (err) => alert(err.error?.error || 'Ошибка удаления')
      });
    }
  }

  private sortMembersByRole(members: IMemberResponse[]): IMemberResponse[] {
    const rolePriority: { [key: string]: number } = {
      'OWNER': 1,
      'ADMIN': 2,
      'MEMBER': 3,
      'GUEST': 4
    };

    return [...members].sort((a, b) => {
      // Сначала по приоритету роли
      const priorityA = rolePriority[a.roleName] ?? 99;
      const priorityB = rolePriority[b.roleName] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Если роли одинаковые, сортируем по displayName или email (алфавит)
      const nameA = (a.displayName || a.email).toLowerCase();
      const nameB = (b.displayName || b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  editMember(member: IMemberResponse) {
    this.editingMember = { ...member };
    this.showEditModal = true;
  }

  updateMember() {
    if (!this.editingMember) return;

    this.memberService.updateMember(
      this.editingMember.userId,
      this.editingMember.roleName,
      this.editingMember.displayName
    ).subscribe({
      next: () => {
        this.showEditModal = false;
        this.loadMembers();
      },
      error: (err) => alert(err.error?.error || 'Ошибка обновления')
    });
  }

  resetPassword(userId: string) {
    const newPassword = prompt('Введите новый пароль (мин. 6 символов)');
    if (newPassword && newPassword.length >= 6) {
      this.memberService.resetPassword(userId, newPassword).subscribe({
        next: () => alert('Пароль успешно изменен'),
        error: (err) => alert(err.error?.error || 'Ошибка сброса пароля')
      });
    }
  }

  filteredMembers() {
    return this.members.filter(member => {
      const matchesSearch = !this.searchQuery ||
        member.displayName?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        member.email.toLowerCase().includes(this.searchQuery.toLowerCase());

      const matchesRole = !this.selectedRole || member.roleName === this.selectedRole;
      const matchesStatus = !this.selectedStatus || member.status === this.selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }



}
