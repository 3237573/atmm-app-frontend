import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {ProjectService} from '@core/services/project.service';
import {ProjectRO} from '@core/models/project.model';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {MemberRO} from '@core/models/member.model';
import {MemberService} from '@core/services';
import {forkJoin} from 'rxjs';
import {ProjectMembersComponent} from '@features/project/project-members/project-members';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, BackOnEscapeDirective, ProjectMembersComponent],
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss'
})
export class ProjectForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly projectService = inject(ProjectService);
  private readonly memberService = inject(MemberService);
  private readonly router = inject(Router);

  allMembers = signal<MemberRO[]>([]);
  isEditMode = signal(false);
  loading = signal(false);
  currentId = signal<string | null>(null);
  currentProject = signal<ProjectRO | null>(null);
  projects = signal<ProjectRO[]>([]);
  showAddMemberModal = signal(false);


  projectVersion = 1;

  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', [Validators.maxLength(500)]],
    status: ['ACTIVE'],
    parentProjectId: [null as string | null]
  });

  ngOnInit() {
    this.loadProjects();
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.currentId.set(id); // Сохраняем ID в сигнал
      this.isEditMode.set(true);
      this.loadProjectDetails(id);
    }
  }

  private loadProjects() {
    this.projectService.getProjects().subscribe(data => this.projects.set(data));
  }

  private loadProjectDetails(id: string) {
    this.loading.set(true);
    forkJoin([
      this.projectService.getProject(id),
      this.memberService.getMembers()]).subscribe({
      next: ([project, members]) => {
        this.currentProject.set(project)
        this.projectVersion = project.version;
        this.form.patchValue({
          title: project.title,
          description: project.description,
          status: project.status,
          parentProjectId: project.parentProjectId
        });

        this.allMembers.set(members)
        this.loading.set(false);
      },
      error: () => this.router.navigate(['/projects'])
    });
  }

  projectMembers = computed(() => {
    const project = this.currentProject()
    if (!project) return [];
    return this.allMembers().filter(m => {
      m.projects?.some(a => a.projectId === project.id)
    });
  })

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const val = this.form.value;
    const id = this.currentId();

    const request$ = (this.isEditMode() && id)
      ? this.projectService.updateProject(id, { ...val, version: this.projectVersion } as any)
      : this.projectService.createProject(val as any);

    request$.subscribe({
      next: () => this.router.navigate(['/projects']),
      error: (err) => {
        console.error(err);
        this.loading.set(false);
      },
      complete: () => this.loading.set(false)
    });
  }

  availableToAssign = computed(() => {
    const memberInProject = new Set(this.projectMembers().map(e => e.id));
    return this.allMembers().filter(m => !memberInProject.has(m.id));
  });

  assignMember(data: { memberId: string; role: string }) {
    const projectId = this.currentId();
    if (!projectId) return;

    this.projectService.assignEmployee(projectId, data.memberId, data.role).subscribe(() => {
      this.loadProjectDetails(projectId); // Перезагружаем проект с новым списком участников
    });
  }

  removeMember(memberId: string) {
    const projectId = this.currentId();
    if (!projectId || !confirm('Удалить участника из проекта?')) return;

    this.projectService.removeEmployee(projectId, memberId).subscribe(() => {
      this.loadProjectDetails(projectId);
    });
  }

  onAddMembers() {
    this.loading.set(true);
    this.showAddMemberModal = signal(true);

  }

  onCancel() {
    this.router.navigate(['/projects']);
  }


}
