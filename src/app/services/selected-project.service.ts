import { Injectable, inject } from '@angular/core';
import { signal } from '@angular/core';
import { ProjectService } from './project.service';

@Injectable({
  providedIn: 'root'
})
export class SelectedProjectService {
  private projectService = inject(ProjectService);

  selectedProject = signal<any>(null);

  setSelectedProject(project: any) {
    this.selectedProject.set(project);
  }

  getSelectedProject() {
    return this.selectedProject;
  }

  loadProjectById(projectId: number) {
    // Load project by ID from the project service
    this.projectService.getProjects().subscribe(projects => {
      const project = projects.find(p => p.projectId === projectId);
      if (project) {
        this.setSelectedProject(project);
      }
    });
  }
}
