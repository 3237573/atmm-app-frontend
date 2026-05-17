import { Component, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MemberRO } from '../../../core/models/member.model';
import { ProjectMemberRO } from '../../../core/models/project.model';

@Component({
  selector: 'app-project-members',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-members.html',
  styleUrl: './project-members.scss'
})
export class ProjectMembersComponent {
  // Входные данные
  projectMembers = input.required<ProjectMemberRO[]>();
  allMembers = input.required<MemberRO[]>();
  loading = input<boolean>(false);

  // События
  onAdd = output<{ membershipId: string; role: string }>();
  onRemove = output<string>();

  showModal = signal(false);

  // Маппинг: превращаем скучные ID в объекты с именами
  displayMembers = computed(() => {
    const all = this.allMembers();
    return this.projectMembers().map(pm => {
      const details = all.find(m => m.id === pm.membershipId);
      return {
        ...pm,
        name: details?.displayName || 'Загрузка...',
        email: details?.email,
        initials: details?.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'
      };
    });
  });

  // Список тех, кого еще можно добавить
  availableToAssign = computed(() => {
    const currentIds = new Set(this.projectMembers().map(m => m.membershipId));
    return this.allMembers().filter(m => !currentIds.has(m.id));
  });

  add(membershipId: string, role: string) {
    this.onAdd.emit({ membershipId, role });
    this.showModal.set(false);
  }
}
