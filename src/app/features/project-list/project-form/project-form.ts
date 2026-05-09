import {Component, OnInit, inject, signal, HostListener} from '@angular/core';
import {CommonModule, Location} from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ProjectService } from '../../../core/services/project/project.service';
import { ProjectRO } from '../../../core/models/project.model';
import {BackOnEscapeDirective} from '../../../core/services/navigation/back-on-escape';

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, BackOnEscapeDirective],
  templateUrl: './project-form.html',
  styleUrl: './project-form.scss'
})
export class ProjectForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly route = inject(ActivatedRoute); // Оставляем private
  private readonly router = inject(Router);

  isEditMode = signal(false);
  loading = signal(false);
  projects = signal<ProjectRO[]>([]);
  currentId = signal<string | null>(null); // Добавляем сигнал для ID
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
    this.projectService.getProject(id).subscribe({
      next: (p) => {
        this.projectVersion = p.version;
        this.form.patchValue({
          title: p.title,
          description: p.description,
          status: p.status,
          parentProjectId: p.parentProjectId
        });
        this.loading.set(false);
      },
      error: () => this.router.navigate(['/projects'])
    });
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true);

    const val = this.form.value;
    const id = this.currentId();

    const obs = (this.isEditMode() && id)
      ? this.projectService.updateProject(id, { ...val, version: this.projectVersion } as any)
      : this.projectService.createProject(val as any);

    obs.subscribe({
      next: () => this.router.navigate(['/projects']),
      error: () => this.loading.set(false)
    });
  }

  onCancel() {
    this.router.navigate(['/projects']);
  }

}
