import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {ProjectService} from '@core/services/project.service';
import {ProjectRO} from '@core/models/project.model';
import {BackOnEscapeDirective} from '@core/directives/back-on-escape.directive';
import {TranslocoPipe} from '@ngneat/transloco';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, BackOnEscapeDirective, TranslocoPipe],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss'
})
export class ProjectList implements OnInit {
  private readonly projectService = inject(ProjectService);

  readonly rawProjects = signal<ProjectRO[]>([]); // Изменили с private на readonly, чтобы шаблон имел доступ, если нужно

  loading = signal(true);
  expandedNodes = signal<Set<string>>(new Set());

  projectTree = computed(() => {
    const list = this.rawProjects();
    const map = new Map<string | null, ProjectRO[]>();

    list.forEach(project => {
      const pId = project.parentProjectId || null;
      if (!map.has(pId)) map.set(pId, []);
      map.get(pId)!.push({ ...project, subProjects: [] as ProjectRO[] });
    });

    const build = (parentProjectId: string | null): ProjectRO[] => {
      const children = map.get(parentProjectId) || [];
      return children.map(child => ({
        ...child,
        subProjects: build(child.id)
      }));
    };

    return build(null);
  });

  ngOnInit() { this.load(); }

  load() {
    this.projectService.getProjects().subscribe({
      next: (data) => {
        this.rawProjects.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleNode(id: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const newSet = new Set(this.expandedNodes());
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    this.expandedNodes.set(newSet);
  }

  // ДОБАВЛЕННЫЕ ХЕЛПЕРЫ ДЛЯ ШАБЛОНА:
  getStatusLabel(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'Активен';
      case 'PLANNING': return 'Планирование';
      case 'COMPLETED': return 'Завершен';
      default: return status || 'В работе';
    }
  }

  isOverdue(deadlineStr: string | Date | undefined): boolean {
    if (!deadlineStr) return false;
    return new Date(deadlineStr).getTime() < new Date().getTime();
  }
}
