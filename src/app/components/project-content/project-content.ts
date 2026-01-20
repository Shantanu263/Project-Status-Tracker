import { ChangeDetectionStrategy, Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectedProjectService } from '../../services/selected-project.service';
import { BoardComponent } from '../board/board';
import { MembersComponent } from '../members/members';
import { DashboardComponent } from '../dashboard/dashboard';
import { PhasesComponent } from '../phases/phases';
import { TimelineComponent } from '../timeline/timeline';
import { TasksComponent } from '../tasks/tasks';
import { UserManagementComponent } from '../user-management/user-management';
import { ProjectService } from '../../services/project.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProjectMetaBarComponent } from '../project-meta-bar/project-meta-bar';
import { ProjectDetailsModalComponent } from '../project-details-modal/project-details-modal';
import { ConfirmationDialogComponent } from '../shared/confirmation-dialog/confirmation-dialog';
import { AuthService } from '../../services/auth.service';

type TabType = 'summary' | 'board' | 'phases' | 'tasks' | 'members' | 'timeline' | 'calendar';

@Component({
  selector: 'app-project-content',
  imports: [CommonModule, BoardComponent, MembersComponent, DashboardComponent, PhasesComponent, TimelineComponent, TasksComponent, UserManagementComponent, ProjectMetaBarComponent, ProjectDetailsModalComponent, ConfirmationDialogComponent],
  templateUrl: './project-content.html',
  styleUrl: './project-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectContentComponent {
  private readonly selectedProjectService = inject(SelectedProjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly authService = inject(AuthService);

  activeTab = signal<TabType>('summary');
  selectedProject = computed(() => this.selectedProjectService.getSelectedProject()());
  isUserManagement = signal(false);

  // Get projects list to check if user has any projects
  projects = toSignal(this.projectService.getProjects(), { initialValue: [] });
  hasNoProjects = computed(() => this.projects().length === 0);

  // Project menu and modal state
  showProjectMenu = signal<boolean>(false);
  showProjectDetailsModal = signal<boolean>(false);
  showDeleteConfirmation = signal<boolean>(false);
  showSnackbar = signal<boolean>(false);
  snackbarMessage = signal<string>('');

  tabs: { label: string; value: TabType }[] = [
    { label: 'Summary', value: 'summary' },
    { label: 'Board', value: 'board' },
    { label: 'Phases', value: 'phases' },
    { label: 'Tasks', value: 'tasks' },
    { label: 'Members', value: 'members' },
    { label: 'Timeline', value: 'timeline' }
  ];

  constructor() {
    // Subscribe to route params to handle navigation
    effect(() => {
      this.route.params.subscribe(params => {
        const projectId = params['projectId'];
        const tab = params['tab'] as TabType;

        if (projectId) {
          // Load project if projectId is in URL
          const currentProject = this.selectedProject();
          if (!currentProject || currentProject.projectId !== Number(projectId)) {
            // Load project from service
            this.selectedProjectService.loadProjectById(Number(projectId));
          }

          // Set active tab from URL or default to summary
          this.activeTab.set(tab || 'summary');
          this.isUserManagement.set(false);
        }
      });

      // Check if we're on user management route
      this.route.url.subscribe(segments => {
        const isUserMgmt = segments.some(segment => segment.path === 'user-management');
        this.isUserManagement.set(isUserMgmt);

        if (isUserMgmt) {
          // Clear selected project when on user management
          this.selectedProjectService.setSelectedProject(null);
        }
      });
    }, { allowSignalWrites: true });
  }

  selectTab(tab: TabType) {
    const project = this.selectedProject();
    if (project) {
      // Navigate to the tab route
      this.router.navigate(['/home/projects', project.projectId, tab]);
    }
  }

  canManageProject(): boolean {
    const project = this.selectedProject();
    if (!project) return false;

    const currentUserId = this.authService.getCurrentUserId();
    return this.authService.canManageProject(project.projectMembers, currentUserId);
  }

  toggleProjectMenu() {
    this.showProjectMenu.update(v => !v);
  }

  openEditModal() {
    this.showProjectMenu.set(false);
    this.showProjectDetailsModal.set(true);
  }

  openDeleteConfirmation() {
    this.showProjectMenu.set(false);
    this.showDeleteConfirmation.set(true);
  }

  cancelDelete() {
    this.showDeleteConfirmation.set(false);
  }

  confirmDelete() {
    this.showDeleteConfirmation.set(false);
    this.deleteProject();
  }

  private deleteProject() {
    const project = this.selectedProject();
    if (!project) return;

    this.projectService.deleteProject(project.projectId).subscribe({
      next: () => {
        // Clear the current selected project immediately
        this.selectedProjectService.setSelectedProject(null);

        // Show success message
        this.showSnackbarMessage('Project deleted successfully');

        // Navigate to home first to avoid routing conflicts
        this.router.navigate(['/home']).then(() => {
          // After navigation, reload projects and select next available one
          this.projectService.getProjects().subscribe({
            next: (projects) => {
              if (projects.length > 0) {
                // If there are other projects, navigate to the first one
                const firstProject = projects[0];
                // Use setTimeout to ensure the navigation happens after the current cycle
                setTimeout(() => {
                  this.router.navigate(['/home/projects', firstProject.projectId, 'summary']);
                }, 100);
              }
              // If no projects, stay on /home which will show the no-projects placeholder
            },
            error: (err) => {
              console.error('Error reloading projects after deletion:', err);
            }
          });
        });
      },
      error: (err) => {
        console.error(err);
      }
    });
  }

  showSnackbarMessage(message: string) {
    this.snackbarMessage.set(message);
    this.showSnackbar.set(true);
    setTimeout(() => {
      this.showSnackbar.set(false);
    }, 3000);
  }

  closeProjectDetailsModal() {
    this.showProjectDetailsModal.set(false);
  }

  onProjectUpdated() {
    // Refresh project data
    const project = this.selectedProject();
    if (project) {
      this.selectedProjectService.loadProjectById(project.projectId);
    }
  }

  onProjectDeleted() {
    // Clear the current selected project immediately
    this.selectedProjectService.setSelectedProject(null);

    // Show success message
    this.showSnackbarMessage('Project deleted successfully');

    // Navigate to home first to avoid routing conflicts
    this.router.navigate(['/home']).then(() => {
      // After navigation, reload projects and select next available one
      this.projectService.getProjects().subscribe({
        next: (projects) => {
          if (projects.length > 0) {
            // If there are other projects, navigate to the first one
            const firstProject = projects[0];
            // Use setTimeout to ensure the navigation happens after the current cycle
            setTimeout(() => {
              this.router.navigate(['/home/projects', firstProject.projectId, 'summary']);
            }, 100);
          }
          // If no projects, stay on /home which will show the no-projects placeholder
        },
        error: (err) => {
          console.error('Error reloading projects after deletion:', err);
        }
      });
    });
  }
}
