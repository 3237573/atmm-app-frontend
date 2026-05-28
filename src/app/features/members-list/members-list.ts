import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MemberService} from '@core/services';
import {MemberRO} from '@core/models/member.model';
import {Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {AuthService} from '@core/services/auth.service';
import {ChatService} from '@core/services/chat.service';
import {firstValueFrom} from 'rxjs';

@Component({
  selector: 'app-members-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './members-list.html',
  styleUrl: './members-list.scss'
})
export class MembersList implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly chatService = inject(ChatService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);

  members = signal<MemberRO[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  selectedRole = signal('');
  selectedDepartment = signal('');

  currentUser = computed(() => this.authService.currentUser());

  ngOnInit(): void {
    this.loadMembers();
  }

  loadMembers(): void {
    this.loading.set(true);
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members.set(this.sortMembersByRole(data));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки', err);
        this.loading.set(false);
      }
    });
  }

  filteredMembers(): MemberRO[] {
    return this.members().filter(member => {
      const matchesSearch = !this.searchQuery() ||
        member.displayName?.toLowerCase().includes(this.searchQuery().toLowerCase()) ||
        member.email.toLowerCase().includes(this.searchQuery().toLowerCase());

      const matchesRole = !this.selectedRole() || member.roleName === this.selectedRole();

      return matchesSearch && matchesRole;
    });
  }



  private sortMembersByRole(members: MemberRO[]): MemberRO[] {
    const rolePriority: { [key: string]: number } = {
      'OWNER': 1,
      'ADMIN': 2,
      'MEMBER': 3,
      'GUEST': 4
    };

    return [...members].sort((a, b) => {
      const priorityA = rolePriority[a.roleName] ?? 99;
      const priorityB = rolePriority[b.roleName] ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;

      const nameA = (a.displayName || a.email).toLowerCase();
      const nameB = (b.displayName || b.email).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  // Действия с пользователем
  async sendMessage(member: MemberRO): Promise<void> {
    const myMemberId = this.authService.currentMember()?.id;
    const targetMemberId = member.id;
    if (!myMemberId || !targetMemberId) return;

    const rooms = await firstValueFrom(this.chatService.getUserRooms());
    let directRoom = rooms.find(r => r.type === 'DIRECT' && r.memberCount === 2);

    if (!directRoom) {
      directRoom = await firstValueFrom(this.chatService.createRoom({
        type: 'DIRECT',
        memberIds: [myMemberId, targetMemberId]
        // name не передаём (оно необязательное)
      }));
    }

    if (directRoom) {
      this.router.navigate(['/chat', directRoom.id]);
    }
  }

  assignTask(member: MemberRO): void {
    // Переходим на создание задачи с параметром исполнителя
    void this.router.navigate(['/tasks/create'], {
      queryParams: { assigneeId: member.id, assigneeName: member.displayName }
    });
  }

  viewProfile(member: MemberRO): void {
    this.router.navigate(['/profile', member.id]);
  }

  getRoleBadgeClass(roleName: string): string {
    switch(roleName) {
      case 'OWNER': return 'owner';
      case 'ADMIN': return 'admin';
      case 'MEMBER': return 'member';
      case 'GUEST': return 'guest';
      default: return 'member';
    }
  }



}
