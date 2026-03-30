import { Component, input, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { SelectedProjectService } from '../../services/selected-project.service';
import { PermissionService } from '../../services/permission.service';
import { AuthService } from '../../services/auth.service';
import { DataSyncService } from '../../services/data-sync.service';
import { DelayTrackerService } from '../../services/delay-tracker.service';
import { Phase, Task } from '../../models/phase.model';
import { ProjectMember } from '../../models/project.model';
import { ChangeDetectionStrategy } from '@angular/core';
import { ModalComponent } from '../shared/modal/modal';
import { ConfirmationDialogComponent } from '../shared/confirmation-dialog/confirmation-dialog';
import { PhaseFormComponent } from './phase-form/phase-form';
import { TaskFormComponent } from './task-form/task-form';
import { PhaseDetailsModalComponent } from './phase-details-modal/phase-details-modal';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

interface BulkUpdateResponse {
  successIds: number[];
  failedItems: { id: number; reason: string }[];
}

interface SnackbarMessage {
  message: string;
  type: 'success' | 'error' | 'info';
}


@Component({
  selector: 'app-phases',
  imports: [CommonModule, FormsModule, ModalComponent, ConfirmationDialogComponent, PhaseFormComponent, TaskFormComponent, PhaseDetailsModalComponent],
  templateUrl: './phases.html',
  styleUrl: './phases.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhasesComponent {
  private readonly projectService = inject(ProjectService);
  private readonly selectedProjectService = inject(SelectedProjectService);
  private readonly authService = inject(AuthService);
  private readonly permissionService = inject(PermissionService);
  private readonly dataSyncService = inject(DataSyncService);
  private readonly delayTrackerService = inject(DelayTrackerService);
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);

  projectId = input.required<number>();

  phases = signal<Phase[]>([]);
  isLoading = signal(false);
  expandedPhases = signal<Set<number>>(new Set());
  phaseTasks = signal<Map<number, Task[]>>(new Map());

  // Modal states
  showPhaseModal = signal(false);
  showTaskModal = signal(false);
  showDeletePhaseDialog = signal(false);
  showDeleteTaskDialog = signal(false);
  showDetailModal = signal(false);
  showPhaseDetailsModal = signal(false);

  // Selected items for edit/delete
  selectedPhase = signal<Phase | null>(null);
  selectedTask = signal<Task | null>(null);
  selectedPhaseIdForTask = signal<number | null>(null);
  selectedPhaseId = signal<number | null>(null);

  // Detail modal
  detailModalMode = signal<'phase' | 'task'>('phase');
  detailModalItem = signal<Phase | Task | null>(null);
  projectMembers = signal<ProjectMember[]>([]);

  // New UI state for list/grid view
  viewMode = signal<'list' | 'grid'>('list');

  // Filter states
  searchTerm = signal('');
  statusFilter = signal<string>('all');
  sortBy = signal<'name' | 'date' | 'status'>('name');
  sortOrder = signal<'asc' | 'desc'>('asc');

  // Bulk selection state
  selectedPhaseIds = signal<Set<number>>(new Set());
  showBulkEditModal = signal(false);
  showBulkDeleteModal = signal(false);
  isBulkOperating = signal(false);
  snackbar = signal<SnackbarMessage | null>(null);
  private snackbarTimer: any = null;

  // Bulk edit form values (no Priority for phases)
  bulkEditStatus = signal<string>('');
  bulkEditAssignee = signal<string>('');
  bulkEditStartDate = signal<string>('');
  bulkEditEndDate = signal<string>('');

  // Bulk Add to Delay Tracker
  showBulkDelayModal = signal(false);
  showInvalidItemsModal = signal(false);
  bulkDelayRevisedEndDate = signal<string>('');
  bulkDelayReason = signal<string>('');

  private bulkDelayEligibility = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const eligible: Phase[] = [];
    const invalid: { item: Phase; reason: string }[] = [];

    const allPhases = this.phases();
    for (const id of this.selectedPhaseIds()) {
      const phase = allPhases.find(p => p.phaseId === id);
      if (!phase) continue;

      const endDate = phase.endDate ? this.parseBackendDate(phase.endDate) : null;

      if (phase.completedOn && endDate) {
        const completedDate = this.parseBackendDate(phase.completedOn);
        if (completedDate && completedDate > endDate) {
          // Late completed
          eligible.push(phase);
          continue;
        } else {
          invalid.push({ item: phase, reason: 'Completed on time' });
          continue;
        }
      }

      if (!phase.completedOn && endDate && today > endDate) {
        // Overdue
        eligible.push(phase);
      } else {
        invalid.push({ item: phase, reason: 'Not overdue' });
      }
    }
    return { eligible, invalid };
  });

  bulkDelayEligiblePhases = computed(() => this.bulkDelayEligibility().eligible);
  bulkDelayInvalidPhases = computed(() => this.bulkDelayEligibility().invalid);

  // Permission signals
  currentUserId = computed(() => this.authService.getCurrentUserId());

  canCreatePhase = computed(() =>
    this.permissionService.canCreatePhase(this.projectMembers(), this.currentUserId())
  );

  canUpdatePhase = computed(() =>
    this.permissionService.canUpdatePhase(this.projectMembers(), this.currentUserId())
  );

  canDeletePhase = computed(() =>
    this.permissionService.canDeletePhase(this.projectMembers(), this.currentUserId())
  );

  canCreateTask = computed(() =>
    this.permissionService.canCreateTask(this.projectMembers(), this.currentUserId())
  );

  canUpdateTask = computed(() =>
    this.permissionService.canUpdateTask(this.projectMembers(), this.currentUserId())
  );

  canDeleteTask = computed(() =>
    this.permissionService.canDeleteTask(this.projectMembers(), this.currentUserId())
  );

  // Bulk selection computed
  selectedCount = computed(() => this.selectedPhaseIds().size);

  allVisibleSelected = computed(() => {
    const phases = this.filteredPhases();
    if (phases.length === 0) return false;
    const selected = this.selectedPhaseIds();
    return phases.every(p => p.phaseId !== undefined && selected.has(p.phaseId));
  });

  someButNotAllSelected = computed(() => {
    const phases = this.filteredPhases();
    const selected = this.selectedPhaseIds();
    const count = phases.filter(p => p.phaseId !== undefined && selected.has(p.phaseId)).length;
    return count > 0 && count < phases.length;
  });

  // Computed filtered and sorted phases
  filteredPhases = computed(() => {
    let result = [...this.phases()];

    // Apply search filter
    const query = this.searchTerm().toLowerCase();
    if (query) {
      result = result.filter(phase =>
        phase.phaseName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    const status = this.statusFilter();
    if (status !== 'all') {
      result = result.filter(phase => phase.status === status);
    }

    // Apply sorting
    const sortType = this.sortBy();
    if (sortType === 'date') {
      result.sort((a, b) => {
        if (!a.startDate) return 1;
        if (!b.startDate) return -1;
        return this.parseDate(a.startDate).getTime() - this.parseDate(b.startDate).getTime();
      });
    } else if (sortType === 'name') {
      result.sort((a, b) => a.phaseName.localeCompare(b.phaseName));
    } else if (sortType === 'status') {
      result.sort((a, b) => {
        const statusA = this.getStatusText(a.status);
        const statusB = this.getStatusText(b.status);
        return statusA.localeCompare(statusB);
      });
    }

    // Default sort by phase ID (ascending) if no other sorting applied
    // This ensures consistent ordering in both list and grid views
    if (result.length > 0 && !sortType) {
      result.sort((a, b) => {
        const idA = a.phaseId ?? 0;
        const idB = b.phaseId ?? 0;
        return idA - idB;
      });
    }

    return result;
  });

  constructor() {
    effect(() => {
      const id = this.projectId();
      if (id) {
        this.loadPhases();
      }
    });

    // Subscribe to phase updates from other components (e.g., phase details modal)
    this.dataSyncService.phasesUpdated$.subscribe(projectId => {
      if (projectId === this.projectId()) {
        this.loadPhases();
      }
    });

    // Subscribe to task updates from other components
    this.dataSyncService.tasksUpdated$.subscribe(({ projectId }) => {
      if (projectId === this.projectId()) {
        this.loadPhases();
      }
    });

    // Subscribe to project member updates from other components
    this.dataSyncService.projectMembersUpdated$.subscribe(projectId => {
      if (projectId === this.projectId()) {
        this.loadProjectMembers();
      }
    });

    // Listen for query params to open phase modal from notifications
    this.route.queryParams.subscribe(params => {
      const openPhaseId = params['openPhaseId'];
      if (openPhaseId) {
        console.log('[PhasesComponent] Opening phase from notification:', openPhaseId);
        // Wait a bit for phases to load
        setTimeout(() => {
          this.selectedPhaseId.set(Number(openPhaseId));
          this.showPhaseDetailsModal.set(true);
        }, 500);
      }
    });
  }

  private loadProjectMembers(): void {
    this.projectService.getProjectMembers(this.projectId()).subscribe({
      next: (members) => {
        this.projectMembers.set(members);
        // Reload phases to update assignee names
        this.loadPhases();
      },
      error: (err) => {
        console.error('Error loading project members:', err);
      }
    });
  }

  private loadPhases(): void {
    this.isLoading.set(true);
    // Load both phases and project members
    this.projectService.getPhases(this.projectId()).subscribe({
      next: (phases) => {
        // Load project members if not already loaded
        if (this.projectMembers().length === 0) {
          this.projectService.getProjectMembers(this.projectId()).subscribe({
            next: (members) => {
              this.projectMembers.set(members);
              // Map assignee names to phases
              const phasesWithAssignees = phases.map(phase => {
                const assignedMember = members.find(m => m.memberId === phase.projectMemberId);
                return {
                  ...phase,
                  assignedToName: assignedMember?.user || undefined
                };
              });
              this.phases.set(phasesWithAssignees);
              this.isLoading.set(false);
            },
            error: (err) => {
              console.error('Error loading project members:', err);
              this.phases.set(phases);
              this.isLoading.set(false);
            }
          });
        } else {
          // Members already loaded, just map assignee names
          const members = this.projectMembers();
          const phasesWithAssignees = phases.map(phase => {
            const assignedMember = members.find(m => m.memberId === phase.projectMemberId);
            return {
              ...phase,
              assignedToName: assignedMember?.user || undefined
            };
          });
          this.phases.set(phasesWithAssignees);
          this.isLoading.set(false);
        }
      },
      error: (err) => {
        console.error('Error loading phases:', err);
        this.isLoading.set(false);
      }
    });
  }

  togglePhase(phaseId: number | undefined): void {
    if (!phaseId) return;

    const expanded = this.expandedPhases();
    if (expanded.has(phaseId)) {
      expanded.delete(phaseId);
    } else {
      expanded.add(phaseId);
      // Load tasks if not already loaded
      if (!this.phaseTasks().has(phaseId)) {
        this.loadTasks(phaseId);
      }
    }
    this.expandedPhases.set(new Set(expanded));
  }

  private loadTasks(phaseId: number): void {
    this.projectService.getTasks(this.projectId(), phaseId).subscribe({
      next: (tasks) => {
        const map = this.phaseTasks();
        map.set(phaseId, tasks);
        this.phaseTasks.set(new Map(map));
      },
      error: (err) => {
        console.error(`Error loading tasks for phase ${phaseId}:`, err);
      }
    });
  }

  isPhaseExpanded(phaseId: number | undefined): boolean {
    return phaseId ? this.expandedPhases().has(phaseId) : false;
  }

  getTasksForPhase(phaseId: number | undefined): Task[] {
    return phaseId ? this.phaseTasks().get(phaseId) || [] : [];
  }

  getStatusBadgeColor(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'done':
        return 'bg-green-100 text-green-700';
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'review':
        return 'bg-yellow-100 text-yellow-700';
      case 'to_do':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }

  getStatusLabel(status?: string): string {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  getStatusIndicatorColor(status?: string): string {
    switch (status?.toLowerCase()) {
      case 'done':
        return 'bg-green-500';
      case 'ongoing':
      case 'in_progress':
        return 'bg-blue-500';
      case 'review':
        return 'bg-yellow-500';
      case 'to_do':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  }

  getTaskCount(phase: Phase): number {
    return phase.tasks?.length || 0;
  }

  getCompletedTaskCount(phase: Phase): number {
    return phase.tasks?.filter(t => t.status?.toLowerCase() === 'completed').length || 0;
  }

  getProgressPercentage(phase: Phase): number {
    const total = this.getTaskCount(phase);
    if (total === 0) return 0;
    return Math.round((this.getCompletedTaskCount(phase) / total) * 100);
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  private parseDate(dateStr: string): Date {
    // Parse dd-mm-yyyy format
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    // Fallback for other formats
    return new Date(dateStr);
  }

  // Phase CRUD operations
  openAddPhaseModal(): void {
    this.selectedPhase.set(null);
    this.showPhaseModal.set(true);
  }

  closePhaseModal(): void {
    this.showPhaseModal.set(false);
    this.selectedPhase.set(null);
  }

  onPhaseSubmit(phase: Phase): void {
    // Validate that we received a proper Phase object, not an event
    if (!phase || typeof phase !== 'object' || 'isTrusted' in phase || !phase.phaseName) {
      console.warn('Invalid phase submission detected and blocked:', phase);
      return;
    }

    this.projectService.createPhase(this.projectId(), phase).subscribe({
      next: () => {
        this.loadPhases();
        this.closePhaseModal();
        // Notify other components that phases have been updated
        this.dataSyncService.notifyPhasesUpdated(this.projectId());
      }
      // ,
      // error: (err) => {
      //   console.error('Error creating phase:', err);
      // }
    });
  }

  openDeletePhaseDialog(event: Event, phase: Phase): void {
    this.stopPropagation(event);
    this.selectedPhase.set(phase);
    this.showDeletePhaseDialog.set(true);
  }

  closeDeletePhaseDialog(): void {
    this.showDeletePhaseDialog.set(false);
    this.selectedPhase.set(null);
  }

  confirmDeletePhase(): void {
    const phase = this.selectedPhase();
    if (phase && phase.phaseId) {
      this.projectService.deletePhase(this.projectId(), phase.phaseId).subscribe({
        next: () => {
          this.loadPhases();
          this.closeDeletePhaseDialog();
          // Notify other components that phases have been updated
          this.dataSyncService.notifyPhasesUpdated(this.projectId());
        },
        error: (err) => {
          console.error('Error deleting phase:', err);
        }
      });
    }
  }

  // Task CRUD operations
  openAddTaskModal(event: Event, phaseId: number): void {
    this.stopPropagation(event);
    this.selectedTask.set(null);
    this.selectedPhaseIdForTask.set(phaseId);
    this.showTaskModal.set(true);
  }

  closeTaskModal(): void {
    this.showTaskModal.set(false);
    this.selectedTask.set(null);
    this.selectedPhaseIdForTask.set(null);
  }

  onTaskSubmit(task: Task): void {
    if (!task || typeof task !== 'object' || 'isTrusted' in task || !task.taskName) {
      console.warn('Invalid task submission detected and blocked:', task);
      return;
    }

    const phaseId = this.selectedPhaseIdForTask();
    if (phaseId) {
      this.projectService.createTask(this.projectId(), phaseId, task).subscribe({
        next: () => {
          this.loadTasks(phaseId);
          this.closeTaskModal();
          // Notify other components that tasks have been updated
          this.dataSyncService.notifyTasksUpdated(this.projectId(), phaseId);
        },
        error: (err) => {
          console.error('Error creating task:', err);
          this.closeTaskModal();
        }
      });
    }
  }

  openDeleteTaskDialog(event: Event, task: Task, phaseId: number): void {
    this.stopPropagation(event);
    this.selectedTask.set(task);
    this.selectedPhaseIdForTask.set(phaseId);
    this.showDeleteTaskDialog.set(true);
  }

  closeDeleteTaskDialog(): void {
    this.showDeleteTaskDialog.set(false);
    this.selectedTask.set(null);
    this.selectedPhaseIdForTask.set(null);
  }

  confirmDeleteTask(): void {
    const task = this.selectedTask();
    const phaseId = this.selectedPhaseIdForTask();
    if (task && task.taskId && phaseId) {
      this.projectService.deleteTask(this.projectId(), phaseId, task.taskId).subscribe({
        next: () => {
          this.loadTasks(phaseId);
          this.closeDeleteTaskDialog();
        },
        error: (err) => {
          console.error('Error deleting task:', err);
        }
      });
    }
  }

  // Detail Modal operations
  openPhaseDetails(event: Event, phase: Phase): void {
    this.stopPropagation(event);
    if (phase.phaseId) {
      this.selectedPhaseId.set(phase.phaseId);
      this.showPhaseDetailsModal.set(true);
    }
  }

  closePhaseDetailsModal(): void {
    this.showPhaseDetailsModal.set(false);
    this.selectedPhaseId.set(null);
    // No need to reload phases here - the dataSyncService.phasesUpdated$ subscription
    // will handle reloading when actual changes are made in the modal
  }

  onPhaseDetailsUpdated(): void {
    // Reload phases to reflect updates
    this.loadPhases();
  }

  openTaskDetails(event: Event, task: Task, phaseId: number): void {
    this.stopPropagation(event);
    this.detailModalMode.set('task');
    this.detailModalItem.set(task);
    this.selectedPhaseIdForTask.set(phaseId);

    // Load project members for assignment dropdown
    if (this.projectMembers().length === 0) {
      this.projectService.getProjectMembers(this.projectId()).subscribe({
        next: (members) => {
          this.projectMembers.set(members);
        },
        error: (err) => {
          console.error('Error loading project members:', err);
        }
      });
    }

    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.detailModalItem.set(null);
    this.detailModalMode.set('phase');
  }

  onDetailModalSave(updates: any): void {
    const mode = this.detailModalMode();
    const item = this.detailModalItem();

    if (mode === 'phase' && item && 'phaseId' in item && item.phaseId) {
      this.projectService.updatePhase(this.projectId(), item.phaseId, updates).subscribe({
        next: () => {
          this.loadPhases();
          this.closeDetailModal();
          // Notify other components that phases have been updated
          this.dataSyncService.notifyPhasesUpdated(this.projectId());
        },
        error: (err) => {
          console.error('Error updating phase:', err);
          this.closeDetailModal();
        }
      });
    } else if (mode === 'task' && item && 'taskId' in item && item.taskId) {
      const phaseId = this.selectedPhaseIdForTask();
      if (phaseId) {
        this.projectService.updateTask(this.projectId(), phaseId, item.taskId, updates).subscribe({
          next: () => {
            this.loadTasks(phaseId);
            this.loadPhases(); // Reload phases to update progress
            this.closeDetailModal();
          },
          error: (err) => {
            console.error('Error updating task:', err);
            this.closeDetailModal();
          }
        });
      }
    }
  }

  // New UI methods
  setViewMode(mode: 'list' | 'grid'): void {
    this.viewMode.set(mode);
  }

  onSearchChange(query: string): void {
    // Signal will auto-update via ngModel, computed will react
  }

  onStatusFilterChange(status: string): void {
    // Signal will auto-update via ngModel, computed will react
  }

  onSortChange(sortType: string): void {
    // Signal will auto-update via ngModel, computed will react
  }

  getStatusText(status?: string): string {
    if (!status) return 'Open';
    const statusUpper = status.toUpperCase();
    if (statusUpper === 'COMPLETED' || statusUpper === 'DONE') return 'Completed';
    if (statusUpper === 'ONGOING' || statusUpper === 'IN_PROGRESS') return 'Ongoing';
    if (statusUpper === 'OPEN' || statusUpper === 'TO_DO' || statusUpper === 'NOT_STARTED') return 'Open';
    if (statusUpper === 'ON_HOLD') return 'On Hold';
    if (statusUpper === 'CANCELLED') return 'Cancelled';
    return 'Open';
  }

  getStatusBadgeColorNew(status?: string): string {
    const statusText = this.getStatusText(status);
    if (statusText === 'Completed') {
      return 'bg-green-50 border border-green-200 text-green-700';
    } else if (statusText === 'Ongoing') {
      return 'bg-blue-50 border border-blue-200 text-blue-600';
    } else if (statusText === 'On Hold') {
      return 'bg-yellow-50 border border-yellow-200 text-yellow-700';
    } else if (statusText === 'Cancelled') {
      return 'bg-purple-100 border border-purple-200 text-purple-700';
    } else {
      return 'bg-gray-100 border border-gray-300 text-gray-600';
    }
  }

  getProgressBarColor(percentage: number): string {
    if (percentage === 100) {
      return 'bg-green-500';
    } else if (percentage > 0) {
      return 'bg-blue-500';
    } else {
      return 'bg-gray-300';
    }
  }

  formatDuration(startDate?: string, endDate?: string): string {
    if (!startDate || !endDate) return '—';

    const formatDate = (dateStr: string) => {
      // Parse dd-mm-yyyy format
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      // Fallback for other formats
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return `${formatDate(startDate)} → ${formatDate(endDate)}`;
  }

  getLastUpdatedTime(phase: Phase): string {
    if (!phase.updatedAt) return '—';

    const now = new Date();
    const updated = new Date(phase.updatedAt);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  }

  openPhaseActionsMenu(event: Event, phase: Phase): void {
    event.stopPropagation();
    // For now, just open delete dialog - can be expanded to show menu
    this.openDeletePhaseDialog(event, phase);
  }

  viewPhaseTasks(event: Event, phase: Phase): void {
    event.stopPropagation();
    // Toggle phase expansion to show tasks
    if (phase.phaseId) {
      this.togglePhase(phase.phaseId);
    }
  }

  getInitials(name?: string): string {
    if (!name) return 'NA';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getAvatarColor(name?: string): string {
    const colors = [
      'bg-purple-500',
      'bg-green-500',
      'bg-blue-500',
      'bg-orange-500',
      'bg-indigo-500',
      'bg-pink-500',
      'bg-teal-500'
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  }

  isMemberRemoved(memberId?: number | string): boolean {
    if (!memberId) return false;
    const member = this.projectMembers().find(m => m.memberId === memberId);
    return member ? !member.isActive : false;
  }

  // ─── Bulk Selection ─────────────────────────────────────────────────────────

  togglePhaseSelection(phaseId: number, event: Event): void {
    event.stopPropagation();
    const current = new Set(this.selectedPhaseIds());
    if (current.has(phaseId)) {
      current.delete(phaseId);
    } else {
      current.add(phaseId);
    }
    this.selectedPhaseIds.set(current);
  }

  toggleAllPhases(event: Event): void {
    event.stopPropagation();
    const phases = this.filteredPhases();
    if (this.allVisibleSelected()) {
      this.selectedPhaseIds.set(new Set());
    } else {
      const ids = new Set(phases.map(p => p.phaseId!).filter(id => id !== undefined));
      this.selectedPhaseIds.set(ids);
    }
  }

  clearSelection(): void {
    this.selectedPhaseIds.set(new Set());
  }

  isPhaseSelected(phaseId: number): boolean {
    return this.selectedPhaseIds().has(phaseId);
  }

  // ─── Bulk Edit Modal ────────────────────────────────────────────────────────

  openBulkEditPhasesModal(): void {
    this.bulkEditStatus.set('');
    this.bulkEditAssignee.set('');
    this.bulkEditStartDate.set('');
    this.bulkEditEndDate.set('');
    this.showBulkEditModal.set(true);
  }

  closeBulkEditPhasesModal(): void {
    this.showBulkEditModal.set(false);
  }

  onBulkEditStatusChange(event: Event): void {
    this.bulkEditStatus.set((event.target as HTMLSelectElement).value);
  }

  onBulkEditAssigneeChange(event: Event): void {
    this.bulkEditAssignee.set((event.target as HTMLSelectElement).value);
  }

  onBulkEditStartDateChange(event: Event): void {
    this.bulkEditStartDate.set((event.target as HTMLInputElement).value);
  }

  onBulkEditEndDateChange(event: Event): void {
    this.bulkEditEndDate.set((event.target as HTMLInputElement).value);
  }

  executeBulkEditPhases(): void {
    const ids = Array.from(this.selectedPhaseIds());
    if (ids.length === 0) return;

    const updates: Record<string, any> = {};
    if (this.bulkEditStatus()) updates['status'] = this.bulkEditStatus();
    if (this.bulkEditAssignee()) updates['projectMemberId'] = Number(this.bulkEditAssignee());
    if (this.bulkEditStartDate()) {
      updates['startDate'] = this.bulkEditStartDate(); // Already yyyy-MM-dd from input
    }
    if (this.bulkEditEndDate()) {
      updates['endDate'] = this.bulkEditEndDate(); // Already yyyy-MM-dd from input
    }

    if (Object.keys(updates).length === 0) {
      this.closeBulkEditPhasesModal();
      return;
    }

    this.isBulkOperating.set(true);
    const url = `${environment.apiUrl}/project/${this.projectId()}/phase/bulk-update`;
    this.http.put<BulkUpdateResponse>(url, { ids, updates }).subscribe({
      next: (res) => {
        this.isBulkOperating.set(false);
        this.closeBulkEditPhasesModal();
        this.clearSelection();
        this.loadPhases();
        this.dataSyncService.notifyPhasesUpdated(this.projectId());
        const successCount = res.successIds?.length ?? ids.length;
        const failCount = res.failedItems?.length ?? 0;
        if (failCount === 0) {
          this.showSnackbar(`${successCount} phase${successCount !== 1 ? 's' : ''} updated successfully.`, 'success');
        } else {
          this.showSnackbar(`${successCount} updated, ${failCount} failed.`, 'error');
        }
      },
      error: (err) => {
        console.error('Bulk update phases error:', err);
        this.isBulkOperating.set(false);
        this.showSnackbar('Bulk update failed. Please try again.', 'error');
      }
    });
  }

  // ─── Bulk Delete Modal ───────────────────────────────────────────────────────

  openBulkDeletePhasesModal(): void {
    this.showBulkDeleteModal.set(true);
  }

  closeBulkDeletePhasesModal(): void {
    this.showBulkDeleteModal.set(false);
  }

  executeBulkDeletePhases(): void {
    const ids = Array.from(this.selectedPhaseIds());
    if (ids.length === 0) return;

    this.isBulkOperating.set(true);
    const url = `${environment.apiUrl}/project/${this.projectId()}/phase/bulk-delete`;
    this.http.delete<void>(url, { body: { ids } }).subscribe({
      next: () => {
        this.isBulkOperating.set(false);
        this.closeBulkDeletePhasesModal();
        const count = ids.length;
        this.clearSelection();
        this.loadPhases();
        this.dataSyncService.notifyPhasesUpdated(this.projectId());
        this.showSnackbar(`${count} phase${count !== 1 ? 's' : ''} deleted successfully.`, 'success');
      },
      error: (err) => {
        console.error('Bulk delete phases error:', err);
        this.isBulkOperating.set(false);
        this.showSnackbar('Bulk delete failed. Please try again.', 'error');
      }
    });
  }

  // ─── Bulk Add to Delay Tracker ──────────────────────────────────────────────

  openBulkDelayModal(): void {
    this.bulkDelayRevisedEndDate.set('');
    this.bulkDelayReason.set('');
    this.showBulkDelayModal.set(true);
  }

  closeBulkDelayModal(): void {
    this.showBulkDelayModal.set(false);
  }

  openInvalidItemsModal(): void {
    this.showInvalidItemsModal.set(true);
  }

  closeInvalidItemsModal(): void {
    this.showInvalidItemsModal.set(false);
  }

  executeBulkAddDelay(): void {
    const eligible = this.bulkDelayEligiblePhases();
    if (eligible.length === 0) return;

    const revisedEndDate = this.bulkDelayRevisedEndDate();
    const reason = this.bulkDelayReason();
    if (!revisedEndDate || !reason.trim()) return;

    const delayLogs = eligible.map(phase => ({
      projectId: this.projectId(),
      phaseId: phase.phaseId!,
      entityType: 'PHASE' as const,
      originalEndDate: this.formatDateToIso(phase.endDate),
      revisedEndDate,
      status: 'OPEN' as const,
      assigneeId: phase.projectMemberId ? Number(phase.projectMemberId) : undefined,
      reason
    }));

    this.isBulkOperating.set(true);
    this.delayTrackerService.bulkAddDelayLogs(this.projectId(), { delayLogs }).subscribe({
      next: (res) => {
        this.isBulkOperating.set(false);
        this.closeBulkDelayModal();
        const failCount = res.failedEntries?.length ?? 0;
        const successCount = eligible.length - failCount;
        if (failCount === 0) {
          this.showSnackbar(`${successCount} item${successCount !== 1 ? 's' : ''} added to delay tracker.`, 'success');
        } else {
          this.showSnackbar(`${successCount} added, ${failCount} failed.`, 'error');
        }
      },
      error: (err) => {
        console.error('Bulk add delay error:', err);
        this.isBulkOperating.set(false);
        this.showSnackbar('Failed to add delay entries. Please try again.', 'error');
      }
    });
  }

  /** Parse backend date formats: dd-MM-yyyy or yyyy-MM-dd */
  private parseBackendDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    let d: Date;
    if (parts[0].length === 2) {
      // dd-MM-yyyy
      d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    } else {
      // yyyy-MM-dd
      d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    }
    return isNaN(d.getTime()) ? null : d;
  }

  /** Convert backend date (dd-MM-yyyy or yyyy-MM-dd) to ISO yyyy-MM-dd for API */
  private formatDateToIso(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 2) {
      // dd-MM-yyyy → yyyy-MM-dd
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr.substring(0, 10);
  }

  // ─── Snackbar ────────────────────────────────────────────────────────────────

  showSnackbar(message: string, type: 'success' | 'error' | 'info'): void {
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    this.snackbar.set({ message, type });
    this.snackbarTimer = setTimeout(() => {
      this.snackbar.set(null);
    }, 4000);
  }

  dismissSnackbar(): void {
    if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
    this.snackbar.set(null);
  }

}


