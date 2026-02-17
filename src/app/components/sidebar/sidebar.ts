import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CreateProjectModalComponent } from '../create-project/create-project';
import { SelectedProjectService } from '../../services/selected-project.service';
import { ProjectService } from '../../services/project.service';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { NotificationService } from '../../services/notification.service';
import { WebSocketService } from '../../services/websocket.service';
import { LucideAngularModule, User } from 'lucide-angular';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AccountPanelComponent } from './account-panel/account-panel.component';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown';
import { filter } from 'rxjs/operators';



@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, MatDialogModule, MatSnackBarModule, AccountPanelComponent, NotificationDropdownComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  private readonly dialog = inject(MatDialog);
  private readonly selectedProjectService = inject(SelectedProjectService);
  private readonly projectService = inject(ProjectService);
  private readonly sidebarStateService = inject(SidebarStateService);
  private readonly notificationService = inject(NotificationService);
  private readonly webSocketService = inject(WebSocketService);
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
  notificationDropdownOpen = signal(false);
  unreadCount = signal<number>(0);

  isSuperAdmin = computed(() => this.authService.isSuperAdmin());
  canCreateProject = computed(() => {
    const role = this.authService.getUserRole();
    return role === 'SUPER ADMIN' || role === 'ADMIN';
  });

  projects = signal<any[]>([]);

  selectedProjectId = signal<number | null>(null);
  private readonly selectedProject = computed(() => this.selectedProjectService.getSelectedProject()());

  constructor() {
    // Load projects initially
    this.loadProjects();

    effect(() => {
      const project = this.selectedProject();
      if (project?.projectId) {
        this.selectedProjectId.set(project.projectId);
      } else {
        this.selectedProjectId.set(null);
      }
    }, { allowSignalWrites: true });

    // Watch for route changes to refresh projects list
    // This ensures the sidebar updates when a project is deleted
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.loadProjects();
    });

    // Subscribe to notification unread count
    this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount.set(count);
    });
  }

  private loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (projects) => this.projects.set(projects),
      error: (err) => console.error('Error loading projects:', err)
    });
  }

  refreshProjects(): void {
    this.loadProjects();
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
    const dialogRef = this.dialog.open(CreateProjectModalComponent, {
      panelClass: 'create-project-dialog',
      autoFocus: false,
      restoreFocus: false,
      width: '90%',
      maxWidth: '56rem',
      height: '90vh',
      maxHeight: '90vh'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.projectId) {
        // Refresh the projects list to show the newly created project
        this.refreshProjects();
      }
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

  toggleNotificationDropdown(): void {
    this.notificationDropdownOpen.update((open) => !open);
  }

  closeNotificationDropdown(): void {
    this.notificationDropdownOpen.set(false);
  }

  logout() {
    // Show logout notification at bottom center
    this.snackBar.open('Logging out...', '', {
      duration: 2000,
      panelClass: ['success-snackbar']
    });

    // Delay to allow snackbar to be visible before redirect
    setTimeout(() => {
      // Disconnect WebSocket before logout
      this.webSocketService.disconnect();

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
