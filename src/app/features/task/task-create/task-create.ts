import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TaskService } from '@core/services/task.service';
import { MemberService } from '@core/services/member.service';
import { AuthService } from '@core/services/auth.service';
import { MemberRO } from '@core/models/member.model';
import { TaskCreateRO, TaskPriority, TaskRO, TaskTreeRO } from '@core/models/task/task.model';
import { DepartmentAffiliation } from '@core/models/departament.model';
import { ProjectAffiliation } from '@core/models/project.model';
import { DepartmentService } from '@core/services/departament.service';
import { BackOnEscapeDirective } from '@core/directives/back-on-escape.directive';
import { ComponentDeactivateService } from '@core/services/component-deactivate.service';
import { CanComponentDeactivate } from '@core/interfaces/can-deactivate.interface';
import { TranslocoPipe, TranslocoService } from '@ngneat/transloco';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-task-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BackOnEscapeDirective, TranslocoPipe],
  templateUrl: './task-create.html',
  styleUrls: ['./task-create.scss']
})
export class TaskCreate implements OnInit, OnDestroy, CanComponentDeactivate {
  private readonly authService = inject(AuthService);
  private readonly deactivateService = inject(ComponentDeactivateService);
  private readonly departmentService = inject(DepartmentService);
  private readonly taskService = inject(TaskService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translocoService = inject(TranslocoService);

  private queryParamsSub?: Subscription;

  // ========== Состояния ==========
  currentUser = signal<MemberRO | null>(null);
  departmentMembers = signal<MemberRO[]>([]);
  parentTasksList = signal<{ id: string; title: string }[]>([]);
  pendingFiles = signal<File[]>([]);
  loadingMembers = signal(false);
  loadingUser = signal(false);
  submitting = signal(false);
  uploadingFiles = signal(false);
  userDepartments = signal<DepartmentAffiliation[]>([]);
  userProjects = signal<ProjectAffiliation[]>([]);

  minDate = new Date().toISOString().split('T')[0];

  // ========== Поля формы ==========
  title = signal('');
  description = signal('');
  selectedDepartmentId = signal<string>('');
  projectId = signal<string>('');
  parentTaskId = signal<string>('');
  priority = signal<TaskPriority>('MEDIUM');
  dueDate = signal('');
  assigneeMemberIds = signal<string[]>([]);

  // ========== Модальное окно выбора исполнителей ==========
  showAssigneeModal = signal(false);

  // ========== Валидация ==========
  isFormValid = computed(() =>
    this.title().trim().length > 0 &&
    this.selectedDepartmentId() !== '' &&
    this.assigneeMemberIds().length > 0
  );

  // ========== Отслеживание несохранённых изменений ==========
  private readonly initialData = signal({
    title: '',
    description: '',
    priority: 'MEDIUM' as TaskPriority,
    departmentId: '',
    projectId: '',
    parentTaskId: '',
    assigneeMemberIds: [] as string[],
    dueDate: ''
  });

  ngOnInit(): void {
    this.deactivateService.register(this);
    this.loadCurrentUser();
    this.loadParentTasks();
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      if (params['parentId']) this.parentTaskId.set(params['parentId']);
      if (params['assigneeId']) this.assigneeMemberIds.set([params['assigneeId']]);
      if (params['title']) this.title.set(params['title']);
      this.saveInitialData();
    });
  }

  ngOnDestroy(): void {
    this.deactivateService.unregister();
    this.queryParamsSub?.unsubscribe();
  }

  getPriorityColor(priority: string): string {
    return `priority-${priority.toLowerCase()}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getFileIcon(fileName: string): string {
    const name = fileName.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp)$/.test(name)) return 'image';
    if (name.endsWith('.pdf')) return 'picture_as_pdf';
    if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z')) return 'archive';
    if (name.endsWith('.doc') || name.endsWith('.docx')) return 'description';
    if (name.endsWith('.xls') || name.endsWith('.xlsx')) return 'table_chart';
    return 'insert_drive_file';
  }

  // ---------- Загрузка данных ----------
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
        const uniqueDepartments = Array.from(
          new Map((user.departments || []).map(d => [d.departmentId, d])).values()
        );
        const uniqueProjects = Array.from(
          new Map((user.projects || []).map(p => [p.projectId, p])).values()
        );
        this.userDepartments.set(uniqueDepartments);
        this.userProjects.set(uniqueProjects);
        if (uniqueDepartments.length > 0) {
          this.selectedDepartmentId.set(uniqueDepartments[0].departmentId);
          this.loadDepartmentMembers(uniqueDepartments[0].departmentId);
        }
        this.saveInitialData();
        this.loadingUser.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки пользователя', err);
        this.loadingUser.set(false);
      }
    });
  }

  loadDepartmentMembers(departmentId: string): void {
    this.loadingMembers.set(true);
    this.departmentService.getDepartmentEmployees(departmentId).subscribe({
      next: (members) => {
        const sorted = [...members].sort((a, b) => a.email.localeCompare(b.email));
        this.departmentMembers.set(sorted);
        const validIds = this.assigneeMemberIds().filter(id => sorted.some(m => m.id === id));
        this.assigneeMemberIds.set(validIds);
        this.loadingMembers.set(false);
      },
      error: (err) => {
        console.error('Ошибка загрузки сотрудников', err);
        this.departmentMembers.set([]);
        this.loadingMembers.set(false);
      }
    });
  }

  loadParentTasks(): void {
    this.taskService.getMyTaskTree().subscribe({
      next: (trees) => {
        const allTasks = this.flattenTaskTree(trees);
        allTasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        this.parentTasksList.set(allTasks.map(t => ({ id: t.id, title: t.title })));
      },
      error: (err) => console.error('Ошибка загрузки списка задач', err)
    });
  }

  private flattenTaskTree(trees: TaskTreeRO[]): TaskRO[] {
    const result: TaskRO[] = [];
    const traverse = (nodes: TaskTreeRO[]) => {
      for (const node of nodes) {
        result.push(node.task);
        if (node.subtasks?.length) traverse(node.subtasks);
      }
    };
    traverse(trees);
    return result;
  }

  // ---------- Управление состоянием формы ----------
  saveInitialData(): void {
    this.initialData.set({
      title: this.title(),
      description: this.description(),
      priority: this.priority(),
      departmentId: this.selectedDepartmentId(),
      projectId: this.projectId(),
      parentTaskId: this.parentTaskId(),
      assigneeMemberIds: [...this.assigneeMemberIds()],
      dueDate: this.dueDate()
    });
  }

  hasUnsavedChanges(): boolean {
    const init = this.initialData();
    const curAssignees = [...this.assigneeMemberIds()].sort();
    const initAssignees = [...init.assigneeMemberIds].sort();
    return (
      this.title() !== init.title ||
      this.description() !== init.description ||
      this.priority() !== init.priority ||
      this.selectedDepartmentId() !== init.departmentId ||
      this.projectId() !== init.projectId ||
      this.parentTaskId() !== init.parentTaskId ||
      this.dueDate() !== init.dueDate ||
      JSON.stringify(curAssignees) !== JSON.stringify(initAssignees)
    );
  }

  canDeactivate(): boolean {
    if (this.hasUnsavedChanges()) {
      return confirm(this.translocoService.translate('taskCreate.unsavedChanges'));
    }
    return true;
  }

  // ---------- Исполнители (inline чипсы + модалка) ----------
  getSelectedMembers(): MemberRO[] {
    return this.departmentMembers().filter(m => this.assigneeMemberIds().includes(m.id));
  }

  openAssigneeModal(): void {
    this.showAssigneeModal.set(true);
  }

  closeAssigneeModal(): void {
    this.showAssigneeModal.set(false);
  }

  toggleAssigneeInModal(memberId: string): void {
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

  getDepartmentRole(member: MemberRO): string {
    const currentDeptId = this.selectedDepartmentId();
    const affiliation = member.departments?.find(dept => dept.departmentId === currentDeptId);
    return affiliation ? affiliation.role : this.translocoService.translate('taskCreate.fields.defaultDeptRole');
  }

  getRoleBadgeClass(roleName: string): string {
    switch (roleName?.toUpperCase()) {
      case 'OWNER': return 'owner';
      case 'ADMIN': return 'admin';
      case 'MEMBER': return 'member';
      case 'GUEST': return 'guest';
      default: return 'member';
    }
  }

  onDepartmentChange(departmentId: string): void {
    this.selectedDepartmentId.set(departmentId);
    if (departmentId) {
      this.loadDepartmentMembers(departmentId);
    } else {
      this.departmentMembers.set([]);
      this.assigneeMemberIds.set([]);
    }
  }

  // ---------- Вложения (Drag & Drop) ----------
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(input.files);
      input.value = '';
    }
  }

  onDropFiles(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      this.addFiles(event.dataTransfer.files);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  private addFiles(fileList: FileList | File[]): void {
    const files = Array.from(fileList);
    const valid = files.filter(f => f.size <= 1024 * 1024);
    if (valid.length + this.pendingFiles().length > 3) {
      alert('Максимум 3 файла');
      return;
    }
    this.pendingFiles.update(prev => [...prev, ...valid]);
  }

  removePendingFile(index: number): void {
    this.pendingFiles.update(files => files.filter((_, i) => i !== index));
  }

  // ---------- Отправка формы ----------
  onSubmit(): void {
    if (!this.isFormValid()) return;

    const departmentId = this.selectedDepartmentId();
    const validMemberIds = this.assigneeMemberIds().filter(id =>
      this.departmentMembers().some(m => m.id === id)
    );

    this.submitting.set(true);
    const request: TaskCreateRO = {
      taskStatus: 'PENDING',
      title: this.title().trim(),
      description: this.description().trim() || undefined,
      priority: this.priority(),
      departmentId,
      projectId: this.projectId() || undefined,
      assigneeIds: validMemberIds,
      dueDate: this.dueDate() || undefined,
      parentTaskId: this.parentTaskId() || undefined
    };

    this.taskService.createTask(request).subscribe({
      next: (response: { id: string }) => {
        this.submitting.set(false);
        this.saveInitialData();
        this.uploadAttachments(response.id);
      },
      error: (err) => {
        console.error('Ошибка создания задачи', err);
        this.submitting.set(false);
        alert('Ошибка сервера: ' + (err.error?.message || 'не удалось создать задачу'));
      }
    });
  }

  private uploadAttachments(taskId: string): void {
    const files = this.pendingFiles();
    if (files.length === 0) {
      this.router.navigate(['/tasks']);
      return;
    }
    this.uploadingFiles.set(true);
    let completed = 0;
    const total = files.length;
    files.forEach(file => {
      this.taskService.uploadAttachment(taskId, file).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.uploadingFiles.set(false);
            this.router.navigate(['/tasks']);
          }
        },
        error: () => {
          completed++;
          if (completed === total) {
            this.uploadingFiles.set(false);
            this.router.navigate(['/tasks']);
          }
        }
      });
    });
  }
}
