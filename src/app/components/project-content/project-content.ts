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

type TabType = 'summary' | 'board' | 'phases' | 'tasks' | 'members' | 'timeline' | 'calendar';

@Component({
  selector: 'app-project-content',
  imports: [CommonModule, BoardComponent, MembersComponent, DashboardComponent, PhasesComponent, TimelineComponent, TasksComponent, UserManagementComponent],
  templateUrl: './project-content.html',
  styleUrl: './project-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectContentComponent {
  private readonly selectedProjectService = inject(SelectedProjectService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);

  activeTab = signal<TabType>('summary');
  selectedProject = computed(() => this.selectedProjectService.getSelectedProject()());
  isUserManagement = signal(false);

  // Get projects list to check if user has any projects
  projects = toSignal(this.projectService.getProjects(), { initialValue: [] });
  hasNoProjects = computed(() => this.projects().length === 0);

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
}
