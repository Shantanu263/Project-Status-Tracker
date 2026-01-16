import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CreateProjectModalComponent } from '../create-project/create-project';
import { SelectedProjectService } from '../../services/selected-project.service';
import { ProjectService } from '../../services/project.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { LucideAngularModule, User } from 'lucide-angular';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AccountPanelComponent } from './account-panel/account-panel.component';



@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, AccountPanelComponent],
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
  private readonly snackBar = inject(MatSnackBar);

  User = User;

  user = computed(() => ({
    userId: this.authService.getCurrentUserId() || 0,
    email: this.authService.getCurrentUserEmail() || 'Not available',
    username: this.authService.getCurrentUserName() || 'User',
    role: this.authService.getUserRole() || 'User'
  }));


  sidebarOpen = this.sidebarStateService.sidebarOpen;
  showAccountPanel = signal(false);

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
    const name = this.user().username;
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

  openAccountPanel() {
    this.showAccountPanel.set(true);
  }

  closeAccountPanel() {
    this.showAccountPanel.set(false);
  }

  onUsernameUpdated(newUsername: string) {
    // Update the auth service with the new username for immediate UI updates
    this.authService.setUpdatedUsername(newUsername);
    // The user computed signal will automatically update since it depends on authService.getCurrentUserName()
  }

  logout() {
    // Show logout notification at bottom center
    this.snackBar.open('Logging out...', '', {
      duration: 2000,
      panelClass: ['success-snackbar']
    });

    // Delay to allow snackbar to be visible before redirect
    setTimeout(() => {
      // Call auth service logout to clear tokens and project state
      this.authService.logout();

      // Clear any remaining session storage items
      sessionStorage.clear();

      // Use window.location.href for a hard redirect to ensure the page fully reloads
      // This prevents any cached state and ensures the auth guard runs
      window.location.href = '/auth/login';
    }, 500);
  }
}
