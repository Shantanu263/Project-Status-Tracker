import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CreateProjectModalComponent } from '../create-project/create-project';
import { SelectedProjectService } from '../../services/selected-project.service';
import { ProjectService } from '../../services/project.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { LucideAngularModule, User } from 'lucide-angular';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';



@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, MatDialogModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  private readonly dialog = inject(MatDialog);
  private readonly selectedProjectService = inject(SelectedProjectService);
  private readonly projectService = inject(ProjectService);
  private readonly sidebarStateService = inject(SidebarStateService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  User = User;

  user = signal({ name: this.authService.getCurrentUserName() || 'User' });
  sidebarOpen = this.sidebarStateService.sidebarOpen;
  isSuperAdmin = computed(() => this.authService.isSuperAdmin());
  canCreateProject = computed(() => {
    const role = this.authService.getUserRole();
    return role === 'SUPER ADMIN' || role === 'ADMIN';
  });

  projects = toSignal(this.projectService.getProjects(), {
    initialValue: []
  });

  selectedProjectId = signal<number | null>(null);
  private readonly selectedProject = computed(() => this.selectedProjectService.getSelectedProject()());

  constructor() {
    effect(() => {
      const project = this.selectedProject();
      if (project?.projectId) {
        this.selectedProjectId.set(project.projectId);
      } else {
        this.selectedProjectId.set(null);
      }
    }, { allowSignalWrites: true });
  }

  selectProject(project: any) {
    this.selectedProjectService.setSelectedProject(project);
    this.selectedProjectId.set(project.projectId);
    // Navigate to project route
    this.router.navigate(['/home/projects', project.projectId]);
  }

  toggleSidebar() {
    this.sidebarStateService.toggleSidebar();
  }

  createProject() {
    this.dialog.open(CreateProjectModalComponent, {
      panelClass: 'create-project-dialog',
      autoFocus: false,
      restoreFocus: false,
      width: '90%',
      maxWidth: '56rem',
      height: '90vh',
      maxHeight: '90vh'
    });
  }

  getInitials(): string {
    const name = this.user().name;
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }

  getUserRole(): string {
    return this.authService.getUserRole() || 'User';
  }

  navigateToUserManagement(): void {
    // Deselect any currently selected project
    this.selectedProjectService.setSelectedProject(null);
    this.selectedProjectId.set(null);
    // Navigate to user management route
    this.router.navigate(['/home/user-management']);
  }

  navigateToProjectsDashboard(): void {
    // Deselect any currently selected project
    this.selectedProjectService.setSelectedProject(null);
    this.selectedProjectId.set(null);
    // Navigate to projects dashboard route
    this.router.navigate(['/home/projects-dashboard']);
  }
}
