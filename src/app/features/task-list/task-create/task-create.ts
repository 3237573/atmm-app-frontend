import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TaskService } from '../../../core/services/task/task.service';
import { MemberService } from '../../../core/services/member/member.service';
import { IMemberResponse } from '../../../core/models/member.model';
import { ITaskCreateRO, TaskPriority } from '../../../core/models/task/task.model';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './task-create.html',
  styleUrl: './task-create.scss'
})
export class TaskCreate implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  members = signal<IMemberResponse[]>([]);
  loading = signal(false);
  submitting = signal(false);

  parentTaskId: string | undefined = undefined;
  minDate: string = new Date().toISOString().split('T')[0];

  taskData = {
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    departmentId: '',
    assigneeMembershipIds: [] as string[],
    dueDate: ''
  };

  // Для отслеживания изменений
  private initialData = {
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    departmentId: '',
    assigneeMembershipIds: [] as string[],
    dueDate: ''
  };

  ngOnInit(): void {
    this.loadMembers();

    // Подписываемся на queryParams
    this.route.queryParams.subscribe(params => {
      // 1. Извлекаем parentId (он приходит из TaskDetail.createSubtask)
      if (params['parentId']) {
        this.parentTaskId = params['parentId'];
      }

      // Остальные параметры
      if (params['assigneeId']) {
        this.taskData.assigneeMembershipIds = [params['assigneeId']];
      }
      if (params['title']) {
        this.taskData.title = params['title'];
      }

      // ВАЖНО: Обновляем initialData ПОСЛЕ того, как применили параметры из URL
      // Чтобы Guard не срабатывал сразу при входе на страницу
      this.initialData = JSON.parse(JSON.stringify(this.taskData));
    });
  }

  loadMembers(): void {
    this.loading.set(true);
    this.memberService.getMembers().subscribe({
      next: (data) => {
        this.members.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // Единственный правильный метод проверки на изменения (с сортировкой массивов)
  hasUnsavedChanges(): boolean {
    const currentAssignees = JSON.stringify([...this.taskData.assigneeMembershipIds].sort());
    const initialAssignees = JSON.stringify([...this.initialData.assigneeMembershipIds].sort());

    return this.taskData.title !== this.initialData.title ||
      this.taskData.description !== this.initialData.description ||
      this.taskData.priority !== this.initialData.priority ||
      this.taskData.departmentId !== this.initialData.departmentId ||
      currentAssignees !== initialAssignees ||
      this.taskData.dueDate !== this.initialData.dueDate;
  }

  canDeactivate(): boolean {
    if (this.hasUnsavedChanges()) {
      return confirm('Есть несохранённые изменения. Вы уверены, что хотите уйти?');
    }
    return true;
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    this.router.navigate(['/tasks']);
  }

  onSubmit(): void {
    if (!this.taskData.title.trim()) return;

    // Оптимизировано: используем .some() вместо .find() для булевой проверки
    const validMembershipIds = this.taskData.assigneeMembershipIds.filter(id =>
      this.members().some(m => m.membershipId === id)
    );

    if (validMembershipIds.length === 0) {
      alert('Выберите хотя бы одного исполнителя');
      return;
    }

    this.submitting.set(true);

    // СОБИРАЕМ ПРАВИЛЬНЫЙ ЗАПРОС
    const request: ITaskCreateRO = {
      title: this.taskData.title.trim(),
      description: this.taskData.description?.trim() || undefined,
      priority: this.taskData.priority,
      departmentId: this.taskData.departmentId || undefined,
      assigneeMembershipIds: validMembershipIds,
      dueDate: this.taskData.dueDate || undefined,
      parentTaskId: this.parentTaskId // Передаем ID родителя
    };

    this.taskService.createTask(request).subscribe({
      next: (res) => {
        this.submitting.set(false);
        // Сбрасываем данные перед переходом, чтобы Guard не ругался
        this.initialData = JSON.parse(JSON.stringify(this.taskData));
        this.router.navigate(['/tasks', res.id]);
      },
      error: (err) => {
        console.error('Ошибка создания задачи/подзадачи', err);
        this.submitting.set(false);
        alert('Ошибка сервера: ' + (err.error?.message || 'не удалось создать задачу'));
      }
    });
  }

  toggleAssignee(membershipId: string): void {
    const index = this.taskData.assigneeMembershipIds.indexOf(membershipId);
    if (index === -1) {
      this.taskData.assigneeMembershipIds.push(membershipId);
    } else {
      this.taskData.assigneeMembershipIds.splice(index, 1);
    }
  }

  isSelected(membershipId: string): boolean {
    return this.taskData.assigneeMembershipIds.includes(membershipId);
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
