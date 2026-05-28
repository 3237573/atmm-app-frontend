import { Component, computed, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TaskService } from '../../../core/services/task.service';
import { MemberService } from '../../../core/services/member.service';
import { AuthService } from '../../../core/services/auth.service';
import { MemberRO } from '../../../core/models/member.model';
import { TaskCreateRO, TaskPriority } from '../../../core/models/task/task.model';
import { DepartmentAffiliation } from '../../../core/models/departament.model';
import { ProjectAffiliation } from '../../../core/models/project.model';
import { DepartmentService } from '../../../core/services/departament.service';
import { BackOnEscapeDirective } from '../../../core/directives/back-on-escape.directive';
import { ComponentDeactivateService } from '../../../core/services/component-deactivate.service';
import { CanComponentDeactivate } from '../../../core/interfaces/can-deactivate.interface';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackOnEscapeDirective],
  templateUrl: './task-create.html',
  styleUrl: './task-create.scss'
})
export class TaskCreate implements OnInit, OnDestroy, CanComponentDeactivate {
  private readonly authService = inject(AuthService);
  private readonly deactivateService = inject(ComponentDeactivateService);
  private readonly departmentService = inject(DepartmentService);
  private readonly taskService = inject(TaskService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ========== Состояния ==========
  currentUser = signal<MemberRO | null>(null);
  userDepartments = signal<DepartmentAffiliation[]>([]);
  userProjects = signal<ProjectAffiliation[]>([]);
  departmentMembers = signal<MemberRO[]>([]);

  loadingUser = signal(false);
  loadingMembers = signal(false);
  submitting = signal(false);

  parentTaskId: string | undefined;
  minDate = new Date().toISOString().split('T')[0];

  // ========== Поля формы (сигналы) ==========
  title = signal('');
  description = signal('');
  priority = signal<TaskPriority>('MEDIUM');
  selectedDepartmentId = signal<string>('');
  projectId = signal<string>('');
  assigneeMemberIds = signal<string[]>([]);
  dueDate = signal('');

  // ========== Валидация (computed) ==========
  isFormValid = computed(() => {
    const hasTitle = this.title().trim().length > 0;
    const hasDepartment = this.selectedDepartmentId() !== '';
    const hasAssignees = this.assigneeMemberIds().length > 0;
    return hasTitle && hasDepartment && hasAssignees;
  });

  // ========== Данные для отслеживания несохранённых изменений ==========
  private readonly initialData = signal({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    departmentId: '',
    projectId: '',
    assigneeMemberIds: [] as string[],
    dueDate: ''
  });

  // ========== Lifecycle ==========
  ngOnInit(): void {
    this.deactivateService.register(this);
    this.loadCurrentUser();

    this.route.queryParams.subscribe(params => {
      if (params['parentId']) this.parentTaskId = params['parentId'];
      if (params['assigneeId']) this.assigneeMemberIds.set([params['assigneeId']]);
      if (params['title']) this.title.set(params['title']);
      this.saveInitialData();
    });

    effect(() => {
      const deptId = this.selectedDepartmentId();
      if (deptId && this.currentUser()) {
        this.loadDepartmentMembers(deptId);
      } else {
        this.departmentMembers.set([]);
        this.assigneeMemberIds.set([]);
      }
    });
  }

  ngOnDestroy(): void {
    this.deactivateService.unregister();
  }

  // ========== Загрузка текущего пользователя ==========
  loadCurrentUser(): void {
    this.loadingUser.set(true);
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) {
      this.loadingUser.set(false);
      return;
    }

    this.memberService.getMember(currentUserId).subscribe({
      next: (user) => {
        this.currentUser.set(user);
        const uniqueDepartments = (user.departments || []).filter(
          (dept, idx, self) => self.findIndex(d => d.departmentId === dept.departmentId) === idx
        );
        const uniqueProjects = (user.projects || []).filter(
          (proj, idx, self) => self.findIndex(p => p.projectId === proj.projectId) === idx
        );
        this.userDepartments.set(uniqueDepartments);
        this.userProjects.set(uniqueProjects);

        if (uniqueDepartments.length > 0) {
          const firstDeptId = uniqueDepartments[0].departmentId;
          this.selectedDepartmentId.set(firstDeptId);
          this.loadDepartmentMembers(firstDeptId);
        }

        this.loadingUser.set(false);
        this.saveInitialData();
      },
      error: (err) => {
        console.error('Ошибка загрузки пользователя', err);
        this.loadingUser.set(false);
      }
    });
  }

  // ========== Загрузка сотрудников отдела ==========
  loadDepartmentMembers(departmentId: string): void {
    this.loadingMembers.set(true);
    this.departmentService.getDepartmentEmployees(departmentId).subscribe({
      next: (members) => {
        this.departmentMembers.set(members);
        const validIds = this.assigneeMemberIds().filter(id =>
          members.some(m => m.id === id)
        );
        this.assigneeMemberIds.set(validIds);
        this.loadingMembers.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки сотрудников отдела', err);
        this.departmentMembers.set([]);
        this.loadingMembers.set(false);
      }
    });
  }

  // ========== Сохранение начального состояния ==========
  saveInitialData(): void {
    this.initialData.set({
      title: this.title(),
      description: this.description(),
      priority: this.priority(),
      departmentId: this.selectedDepartmentId(),
      projectId: this.projectId(),
      assigneeMemberIds: [...this.assigneeMemberIds()],
      dueDate: this.dueDate()
    });
  }

  // ========== Проверка наличия несохранённых изменений ==========
  hasUnsavedChanges(): boolean {
    const initial = this.initialData();
    const currentAssignees = [...this.assigneeMemberIds()].sort();
    const initialAssignees = [...initial.assigneeMemberIds].sort();
    return this.title() !== initial.title ||
      this.description() !== initial.description ||
      this.priority() !== initial.priority ||
      this.selectedDepartmentId() !== initial.departmentId ||
      this.projectId() !== initial.projectId ||
      JSON.stringify(currentAssignees) !== JSON.stringify(initialAssignees) ||
      this.dueDate() !== initial.dueDate;
  }

  // ========== Guard для маршрутизатора и Esc ==========
  canDeactivate(): boolean {
    if (this.hasUnsavedChanges()) {
      return confirm('Есть несохранённые изменения. Вы уверены, что хотите уйти?');
    }
    return true;
  }

  // ========== Отправка формы ==========
  onSubmit(): void {
    if (!this.isFormValid()) return;

    const departmentId = this.selectedDepartmentId();
    const validMemberIds = this.assigneeMemberIds().filter(id =>
      this.departmentMembers().some(m => m.id === id)
    );

    this.submitting.set(true);
    const request: TaskCreateRO & { projectId?: string } = {
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      priority: this.priority(),
      departmentId: departmentId,
      projectId: this.projectId() || undefined,
      assigneeIds: validMemberIds,
      dueDate: this.dueDate() || undefined,
      parentTaskId: this.parentTaskId
    };

    this.taskService.createTask(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saveInitialData();
        this.router.navigate(['/tasks']);
      },
      error: (err) => {
        console.error('Ошибка создания задачи', err);
        this.submitting.set(false);
        alert('Ошибка сервера: ' + (err.error?.message || 'не удалось создать задачу'));
      }
    });
  }

  // ========== Управление исполнителями ==========
  toggleAssignee(memberId: string): void {
    const current = this.assigneeMemberIds();
    if (current.includes(memberId)) {
      this.assigneeMemberIds.set(current.filter(id => id !== memberId));
    } else {
      this.assigneeMemberIds.set([...current, memberId]);
    }
  }

  isSelected(memberId: string): boolean {
    return this.assigneeMemberIds().includes(memberId);
  }

  onDepartmentChange(departmentId: string): void {
    this.selectedDepartmentId.set(departmentId);
  }

  getRoleBadgeClass(roleName: string): string {
    switch (roleName) {
      case 'OWNER': return 'owner';
      case 'ADMIN': return 'admin';
      case 'MEMBER': return 'member';
      case 'GUEST': return 'guest';
      default: return 'member';
    }
  }
}
