import { Injectable } from '@angular/core';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SelectedProjectService {
  selectedProject = signal<any>(null);

  setSelectedProject(project: any) {
    this.selectedProject.set(project);
  }

  getSelectedProject() {
    return this.selectedProject;
  }
}
