import {Component, computed, inject, OnInit, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterModule} from '@angular/router';
import {ProjectService} from '../../core/services/project/project.service';
import {ProjectRO} from '../../core/models/project.model';
import {BackOnEscapeDirective} from '../../core/services/navigation/back-on-escape';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterModule, BackOnEscapeDirective],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss'
})
export class ProjectList implements OnInit {
  private readonly projectService = inject(ProjectService);

  private readonly rawProjects = signal<ProjectRO[]>([]);

  loading = signal(true);
  expandedNodes = signal<Set<string>>(new Set());

  projectTree = computed(() => {
    const list = this.rawProjects();
    const map = new Map<string | null, ProjectRO[]>();

    // Группируем проекты по их родителю
    list.forEach(project => {
      const pId = project.parentProjectId || null;
      if (!map.has(pId)) map.set(pId, []);
      // Важно: инициализируем пустой массив для дочерних элементов
      map.get(pId)!.push({ ...project, subProjects: [] as ProjectRO[] });
    });

    // Рекурсивно собираем структуру
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

}
