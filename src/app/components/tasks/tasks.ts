import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProjectService } from '../../services/project.service';
import { Task } from '../../models/phase.model';
import { ProjectMember } from '../../models/project.model';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { PermissionService } from '../../services/permission.service';
import { TaskDetailsModalComponent } from '../phases/task-details-modal/task-details-modal';
import { TaskFormComponent } from '../phases/task-form/task-form';
import { SubtaskDetailsModalComponent } from '../phases/subtask-details-modal/subtask-details-modal';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { DataSyncService } from '../../services/data-sync.service';
import { DelayTrackerService } from '../../services/delay-tracker.service';

interface BulkUpdateResponse {
    successIds: number[];
    failedItems: { id: number; reason: string }[];
}

interface SnackbarMessage {
    message: string;
    type: 'success' | 'error' | 'info';
}

interface TaskWithPhase extends Task {
    phaseName: string;
    phaseId?: number;
}

@Component({
    selector: 'app-tasks',
    imports: [CommonModule, FormsModule, TaskDetailsModalComponent, TaskFormComponent, SubtaskDetailsModalComponent],
    templateUrl: './tasks.html',
    styleUrl: './tasks.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TasksComponent implements OnInit {
    private projectService = inject(ProjectService);
    private authService = inject(AuthService);
    private permissionService = inject(PermissionService);
    private http = inject(HttpClient);
    private dataSyncService = inject(DataSyncService);
    private delayTrackerService = inject(DelayTrackerService);
    private route = inject(ActivatedRoute);
    private cdr = inject(ChangeDetectorRef);

    // Inputs
    projectId = input.required<number>();

    // State
    allTasks = signal<TaskWithPhase[]>([]);
    projectMembers = signal<ProjectMember[]>([]);
    phases = signal<{ phaseId: number; phaseName: string }[]>([]);
    currentUserMemberId = signal<number | string | null>(null);
    searchQuery = signal<string>('');
    selectedPhase = signal<string>('all');
    selectedStatus = signal<string>('all');
    selectedPriority = signal<string>('all');
    isLoading = signal<boolean>(false);
    showFilterPanel = signal<boolean>(false);
    assignedToMe = signal<boolean>(false);
    dueThisWeek = signal<boolean>(false);
    showDoneItems = signal<boolean>(false);
    overdueOnly = signal<boolean>(false);
    startDateFilter = signal<string>('');
    endDateFilter = signal<string>('');
    showTaskDetailsModal = signal<boolean>(false);
    selectedTaskForDetails = signal<{ taskId: number; phaseId: number } | null>(null);
    showCreateTaskModal = signal<boolean>(false);
    expandedTaskIds = signal<Set<number>>(new Set());
    showSubtaskModal = signal<boolean>(false);
    selectedSubtask = signal<{ taskId: number; phaseId: number; subTaskId: number } | null>(null);
    sortColumn = signal<string | null>(null);
    sortDirection = signal<'asc' | 'desc'>('asc');

    // Bulk selection state
    selectedTaskIds = signal<Set<number>>(new Set());
    showBulkEditModal = signal<boolean>(false);
    showBulkDeleteModal = signal<boolean>(false);
    isBulkOperating = signal<boolean>(false);
    snackbar = signal<SnackbarMessage | null>(null);
    private snackbarTimer: any = null;

    // Bulk edit form values
    bulkEditStatus = signal<string>('');
    bulkEditAssignee = signal<string>('');
    bulkEditPriority = signal<string>('');
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

        const eligible: TaskWithPhase[] = [];
        const invalid: { item: TaskWithPhase; reason: string }[] = [];

        const allTasks = this.sortedAndFilteredTasks();
        for (const id of this.selectedTaskIds()) {
            const task = allTasks.find(t => t.taskId === id);
            if (!task) continue;

            const endDate = task.endDate ? this.parseDateFromBackend(task.endDate) : null;

            if (task.completedOn && endDate) {
                const completedDate = this.parseDateFromBackend(task.completedOn);
                if (completedDate) {
                    completedDate.setHours(0, 0, 0, 0);
                    const endDateCopy = new Date(endDate);
                    endDateCopy.setHours(0, 0, 0, 0);
                    if (completedDate > endDateCopy) {
                        eligible.push(task);
                        continue;
                    } else {
                        invalid.push({ item: task, reason: 'Completed on time' });
                        continue;
                    }
                }
            }

            if (!task.completedOn && endDate) {
                const endDateCopy = new Date(endDate);
                endDateCopy.setHours(0, 0, 0, 0);
                if (today > endDateCopy) {
                    eligible.push(task);
                } else {
                    invalid.push({ item: task, reason: 'Not overdue' });
                }
            } else if (!task.completedOn && !endDate) {
                invalid.push({ item: task, reason: 'Not overdue' });
            }
        }
        return { eligible, invalid };
    });

    bulkDelayEligibleTasks = computed(() => this.bulkDelayEligibility().eligible);
    bulkDelayInvalidTasks = computed(() => this.bulkDelayEligibility().invalid);

    // Bulk selection computed
    selectedCount = computed(() => this.selectedTaskIds().size);

    allVisibleSelected = computed(() => {
        const tasks = this.sortedAndFilteredTasks();
        if (tasks.length === 0) return false;
        const selected = this.selectedTaskIds();
        return tasks.every(t => t.taskId !== undefined && selected.has(t.taskId));
    });

    someButNotAllSelected = computed(() => {
        const tasks = this.sortedAndFilteredTasks();
        const selected = this.selectedTaskIds();
        const count = tasks.filter(t => t.taskId !== undefined && selected.has(t.taskId)).length;
        return count > 0 && count < tasks.length;
    });

    // Computed
    phaseNames = computed(() => {
        const tasks = this.allTasks();
        const phaseNames = new Set(tasks.map(t => t.phaseName));
        return Array.from(phaseNames).sort();
    });

    phasesList = computed(() => {
        const tasks = this.allTasks();
        const phaseMap = new Map<number, string>();
        tasks.forEach(t => {
            if (t.phaseId && t.phaseName) {
                phaseMap.set(t.phaseId, t.phaseName);
            }
        });
        return Array.from(phaseMap.entries()).map(([phaseId, phaseName]) => ({
            phaseId,
            phaseName
        }));
    });

    filteredTasks = computed(() => {
        let tasks = this.allTasks();

        // Filter by search query
        const query = this.searchQuery().toLowerCase();
        if (query) {
            tasks = tasks.filter(task =>
                task.taskName.toLowerCase().includes(query) ||
                task.description?.toLowerCase().includes(query)
            );
        }

        // Filter by phase
        if (this.selectedPhase() !== 'all') {
            tasks = tasks.filter(task => task.phaseName === this.selectedPhase());
        }

        // Filter by status
        if (this.selectedStatus() !== 'all') {
            tasks = tasks.filter(task => task.status === this.selectedStatus());
        }

        // Filter by priority
        if (this.selectedPriority() !== 'all') {
            tasks = tasks.filter(task => task.priority === this.selectedPriority());
        }

        // Filter by assigned to me
        if (this.assignedToMe()) {
            const currentMemberId = this.currentUserMemberId();
            if (currentMemberId) {
                tasks = tasks.filter(task => task.assignedToProjectMemberId === currentMemberId);
            }
        }

        // Filter by due this week
        if (this.dueThisWeek()) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            tasks = tasks.filter(task => {
                if (!task.endDate) return false;
                const endDate = this.parseDateFromBackend(task.endDate);
                if (!endDate) return false;
                return endDate >= now && endDate <= weekFromNow;
            });
        }

        // Show only done items if filter is active
        if (this.showDoneItems()) {
            tasks = tasks.filter(task => task.status === 'COMPLETED');
        }

        // Filter by overdue only (non-completed, non-cancelled tasks past their end date)
        if (this.overdueOnly()) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            tasks = tasks.filter(task => {
                if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
                if (!task.endDate) return false;
                const endDate = this.parseDateFromBackend(task.endDate);
                if (!endDate) return false;
                endDate.setHours(0, 0, 0, 0);
                return endDate < today;
            });
        }

        // Filter by start date
        if (this.startDateFilter()) {
            const filterDate = new Date(this.startDateFilter());
            filterDate.setHours(0, 0, 0, 0);
            tasks = tasks.filter(task => {
                if (!task.startDate) return false;
                const taskDate = this.parseDateFromBackend(task.startDate);
                if (!taskDate) return false;
                return taskDate >= filterDate;
            });
        }

        // Filter by end date
        if (this.endDateFilter()) {
            const filterDate = new Date(this.endDateFilter());
            filterDate.setHours(23, 59, 59, 999);
            tasks = tasks.filter(task => {
                if (!task.endDate) return false;
                const taskDate = this.parseDateFromBackend(task.endDate);
                if (!taskDate) return false;
                return taskDate <= filterDate;
            });
        }

        return tasks;
    });

    sortedAndFilteredTasks = computed(() => {
        let tasks = this.filteredTasks();
        const column = this.sortColumn();
        const direction = this.sortDirection();

        if (!column) return tasks;

        return [...tasks].sort((a, b) => {
            let aValue: any;
            let bValue: any;

            switch (column) {
                case 'taskName':
                    aValue = a.taskName?.toLowerCase() || '';
                    bValue = b.taskName?.toLowerCase() || '';
                    break;
                case 'phase':
                    aValue = a.phaseName?.toLowerCase() || '';
                    bValue = b.phaseName?.toLowerCase() || '';
                    break;
                case 'status':
                    const statusOrder = { 'OPEN': 0, 'ONGOING': 1, 'ON_HOLD': 2, 'COMPLETED': 3 };
                    aValue = statusOrder[a.status as keyof typeof statusOrder] ?? 999;
                    bValue = statusOrder[b.status as keyof typeof statusOrder] ?? 999;
                    break;
                case 'assignee':
                    aValue = a.assignedToName?.toLowerCase() || 'zzz';
                    bValue = b.assignedToName?.toLowerCase() || 'zzz';
                    break;
                case 'startDate':
                    aValue = this.parseDateFromBackend(a.startDate || '')?.getTime() || 0;
                    bValue = this.parseDateFromBackend(b.startDate || '')?.getTime() || 0;
                    break;
                case 'endDate':
                    aValue = this.parseDateFromBackend(a.endDate || '')?.getTime() || 0;
                    bValue = this.parseDateFromBackend(b.endDate || '')?.getTime() || 0;
                    break;
                case 'priority':
                    const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
                    aValue = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 999;
                    bValue = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 999;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    });

    // Permission computed signal
    canCreateTask = computed(() => {
        const currentUserId = this.authService.getCurrentUserId();
        return this.permissionService.canCreateTask(this.projectMembers(), currentUserId);
    });

    ngOnInit(): void {
        this.loadTasks();

        // Subscribe to phase updates from other components
        this.dataSyncService.phasesUpdated$.subscribe(projectId => {
            if (projectId === this.projectId()) {
                this.loadTasks();
            }
        });

        // Subscribe to task updates from other components
        this.dataSyncService.tasksUpdated$.subscribe(({ projectId }) => {
            if (projectId === this.projectId()) {
                this.loadTasks();
            }
        });

        // Subscribe to project member updates from other components
        this.dataSyncService.projectMembersUpdated$.subscribe(projectId => {
            if (projectId === this.projectId()) {
                // Reload project members
                this.projectService.getProjectMembers(this.projectId()).subscribe({
                    next: (members) => {
                        this.projectMembers.set(members);
                        // Reload tasks to update assignee names
                        this.loadTasks();
                    },
                    error: (err) => {
                        console.error('Error loading project members:', err);
                    }
                });
            }
        });

        // Listen for query params to open task modal from notifications
        this.route.queryParams.subscribe(params => {
            const openTaskId = params['openTaskId'];
            if (openTaskId) {
                console.log('[TasksComponent] Opening task from notification:', openTaskId);
                // Wait a bit for tasks to load
                setTimeout(() => {
                    // Find the task with this ID
                    const task = this.allTasks().find(t => t.taskId === Number(openTaskId));
                    if (task && task.phaseId) {
                        this.selectedTaskForDetails.set({
                            taskId: Number(openTaskId),
                            phaseId: task.phaseId
                        });
                        this.showTaskDetailsModal.set(true);
                    } else {
                        console.warn('[TasksComponent] Task not found with ID:', openTaskId);
                    }
                }, 500);
            }
        });
    }

    loadTasks(): void {
        this.isLoading.set(true);

        // Fetch both phases and project members
        forkJoin({
            phases: this.projectService.getPhases(this.projectId()),
            members: this.projectService.getProjectMembers(this.projectId())
        }).subscribe({
            next: ({ phases, members }) => {
                this.projectMembers.set(members);

                // Store phases for the task form dropdown
                const phasesData = phases.map(p => ({
                    phaseId: p.phaseId!,
                    phaseName: p.phaseName
                }));
                this.phases.set(phasesData);

                // Find current user's project member ID
                const currentUserId = this.authService.getCurrentUserId();
                if (currentUserId) {
                    const currentMember = members.find(
                        m => m.userId === currentUserId
                    );
                    if (currentMember) {
                        this.currentUserMemberId.set(currentMember.memberId);
                    }
                }

                const tasks: TaskWithPhase[] = [];
                phases.forEach(phase => {
                    if (phase.tasks && phase.tasks.length > 0) {
                        phase.tasks.forEach(task => {
                            // Find the assigned member
                            const assignedMember = members.find(
                                m => m.memberId === task.assignedToProjectMemberId
                            );

                            tasks.push({
                                ...task,
                                phaseName: phase.phaseName,
                                phaseId: phase.phaseId ?? task.projectPhaseId,
                                assignedToName: assignedMember?.user || undefined
                            });
                        });
                    }
                });
                this.allTasks.set(tasks);
                this.isLoading.set(false);
            },
            error: (error) => {
                console.error('Error loading tasks:', error);
                this.isLoading.set(false);
            }
        });
    }

    onSearchChange(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.searchQuery.set(value);
    }

    onPhaseChange(event: Event): void {
        const value = (event.target as HTMLSelectElement).value;
        this.selectedPhase.set(value);
    }

    onStatusChange(event: Event): void {
        const value = (event.target as HTMLSelectElement).value;
        this.selectedStatus.set(value);
    }

    onPriorityChange(event: Event): void {
        const value = (event.target as HTMLSelectElement).value;
        this.selectedPriority.set(value);
    }

    toggleFilterPanel(): void {
        this.showFilterPanel.set(!this.showFilterPanel());
    }

    toggleAssignedToMe(): void {
        this.assignedToMe.set(!this.assignedToMe());
    }

    toggleDueThisWeek(): void {
        this.dueThisWeek.set(!this.dueThisWeek());
    }

    toggleShowDoneItems(): void {
        this.showDoneItems.set(!this.showDoneItems());
    }

    toggleOverdueOnly(): void {
        this.overdueOnly.set(!this.overdueOnly());
    }

    onStartDateChange(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.startDateFilter.set(value);
    }

    onEndDateChange(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.endDateFilter.set(value);
    }

    clearFilters(): void {
        this.selectedPhase.set('all');
        this.selectedStatus.set('all');
        this.selectedPriority.set('all');
        this.assignedToMe.set(false);
        this.dueThisWeek.set(false);
        this.showDoneItems.set(false);
        this.overdueOnly.set(false);
        this.startDateFilter.set('');
        this.endDateFilter.set('');
    }

    getStatusClass(status?: string): string {
        switch (status) {
            case 'ONGOING':
                return 'bg-blue-100 text-blue-800';
            case 'COMPLETED':
                return 'bg-green-100 text-green-800';
            case 'ON_HOLD':
                return 'bg-yellow-100 text-yellow-800';
            case 'CANCELLED':
                return 'bg-purple-100 text-purple-800';
            case 'OPEN':
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    getStatusLabel(status?: string): string {
        switch (status) {
            case 'ONGOING':
                return 'Ongoing';
            case 'COMPLETED':
                return 'Completed';
            case 'ON_HOLD':
                return 'On Hold';
            case 'CANCELLED':
                return 'Cancelled';
            case 'OPEN':
            default:
                return 'Open';
        }
    }

    getPriorityColor(priority?: string): string {
        switch (priority) {
            case 'High':
                return 'text-red-600';
            case 'Medium':
                return 'text-amber-600';
            case 'Low':
            default:
                return 'text-gray-600';
        }
    }

    getPriorityCircleColor(priority?: string): string {
        switch (priority) {
            case 'High':
                return 'bg-red-500';
            case 'Medium':
                return 'bg-yellow-500';
            case 'Low':
            default:
                return 'bg-gray-400';
        }
    }

    getPriorityIconColor(priority?: string): string {
        switch (priority) {
            case 'High':
                return 'text-red-500';
            case 'Medium':
                return 'text-amber-500';
            case 'Low':
            default:
                return 'text-gray-400';
        }
    }

    getTaskTypeIcon(status?: string): string {
        return status === 'COMPLETED' ? 'text-green-500' : 'text-blue-500';
    }

    parseDateFromBackend(date: string): Date | null {
        if (!date) return null;

        // Parse dd-mm-yyyy format from backend
        const parts = date.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
            const year = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
        }

        // Fallback for other formats
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    }

    formatDate(date?: string): string {
        if (!date) return 'N/A';
        const parsedDate = this.parseDateFromBackend(date);
        if (!parsedDate) return 'Invalid Date';
        return parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }


    /**
     * Get completed on date for a task
     * Returns formatted completion date or "—"
     */
    getCompletedOnInfo(task: TaskWithPhase): string {
        if (task.status === 'COMPLETED' && task.completedOn) {
            return this.formatDate(task.completedOn);
        }
        return '—';
    }

    /**
     * Get delay information for a task
     * Returns delay label and color class
     */
    getDelayInfo(task: TaskWithPhase): { label: string; color: string } {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (task.status === 'COMPLETED') {
            // For COMPLETED tasks: check if completed on time or late
            if (task.completedOn && task.endDate) {
                const completedDate = this.parseDateFromBackend(task.completedOn);
                const endDate = this.parseDateFromBackend(task.endDate);

                if (completedDate && endDate) {
                    completedDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);

                    if (completedDate <= endDate) {
                        const earlyMs = endDate.getTime() - completedDate.getTime();
                        const earlyDays = Math.floor(earlyMs / (1000 * 60 * 60 * 24));

                        if (earlyDays > 0) {
                            const earlyText = this.formatDurationText(earlyDays);
                            return { label: `${earlyText} early`, color: 'text-green-600' };
                        }
                        return { label: 'On time', color: 'text-green-600' };
                    } else {
                        // Calculate delay
                        const delayMs = completedDate.getTime() - endDate.getTime();
                        const delayDays = Math.ceil(delayMs / (1000 * 60 * 60 * 24));
                        const delayText = this.formatDurationText(delayDays);
                        return { label: `+${delayText} late`, color: 'text-red-600' };
                    }
                }
            }
            // Fallback for COMPLETED tasks without proper dates
            return { label: '—', color: 'text-gray-600' };
        } else {
            // For non-COMPLETED tasks: check if overdue
            if (task.endDate) {
                const endDate = this.parseDateFromBackend(task.endDate);

                if (endDate) {
                    endDate.setHours(0, 0, 0, 0);

                    if (today > endDate) {
                        // Overdue
                        const overdueMs = today.getTime() - endDate.getTime();
                        const overdueDays = Math.ceil(overdueMs / (1000 * 60 * 60 * 24));
                        const overdueText = this.formatDurationText(overdueDays);
                        return { label: `Overdue ${overdueText}`, color: 'text-orange-600' };
                    }
                }
            }
            // On track or no end date
            return { label: '—', color: 'text-gray-600' };
        }
    }

    /**
     * Get completed on date for a subtask
     */
    getSubtaskCompletedOnInfo(subtask: import('../../models/phase.model').SubTask): string {
        if (subtask.status === 'COMPLETED' && subtask.completedOn) {
            return this.formatDate(subtask.completedOn);
        }
        return '—';
    }

    /**
     * Get delay information for a subtask
     */
    getSubtaskDelayInfo(subtask: import('../../models/phase.model').SubTask): { label: string; color: string } {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (subtask.status === 'COMPLETED') {
            if (subtask.completedOn && subtask.endDate) {
                const completedDate = this.parseDateFromBackend(subtask.completedOn);
                const endDate = this.parseDateFromBackend(subtask.endDate);

                if (completedDate && endDate) {
                    completedDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);

                    if (completedDate <= endDate) {
                        const earlyMs = endDate.getTime() - completedDate.getTime();
                        const earlyDays = Math.floor(earlyMs / (1000 * 60 * 60 * 24));
                        if (earlyDays > 0) {
                            return { label: `${this.formatDurationText(earlyDays)} early`, color: 'text-green-600' };
                        }
                        return { label: 'On time', color: 'text-green-600' };
                    } else {
                        const delayMs = completedDate.getTime() - endDate.getTime();
                        const delayDays = Math.ceil(delayMs / (1000 * 60 * 60 * 24));
                        return { label: `+${this.formatDurationText(delayDays)} late`, color: 'text-red-600' };
                    }
                }
            }
            return { label: '—', color: 'text-gray-600' };
        } else {
            if (subtask.endDate) {
                const endDate = this.parseDateFromBackend(subtask.endDate);
                if (endDate) {
                    endDate.setHours(0, 0, 0, 0);
                    if (today > endDate) {
                        const overdueMs = today.getTime() - endDate.getTime();
                        const overdueDays = Math.ceil(overdueMs / (1000 * 60 * 60 * 24));
                        return { label: `Overdue ${this.formatDurationText(overdueDays)}`, color: 'text-orange-600' };
                    }
                }
            }
            return { label: '—', color: 'text-gray-600' };
        }
    }

    /**
     * Format duration text for display (reused from board component logic)
     * Uses combinations like: 1w4d, 3m2w, 1y2m
     */
    private formatDurationText(days: number): string {
        if (days === 0) return '0d';

        const absDays = Math.abs(days);
        let result = '';

        // Calculate years, months, weeks, and remaining days
        if (absDays >= 365) {
            const years = Math.floor(absDays / 365);
            const remainingDays = absDays % 365;
            const months = Math.floor(remainingDays / 30);

            result = `${years}y`;
            if (months > 0) {
                result += `${months}m`;
            }
        } else if (absDays >= 30) {
            const months = Math.floor(absDays / 30);
            const remainingDays = absDays % 30;
            const weeks = Math.floor(remainingDays / 7);

            result = `${months}m`;
            if (weeks > 0) {
                result += `${weeks}w`;
            }
        } else if (absDays >= 7) {
            const weeks = Math.floor(absDays / 7);
            const remainingDays = absDays % 7;

            result = `${weeks}w`;
            if (remainingDays > 0) {
                result += `${remainingDays}d`;
            }
        } else {
            // Less than a week, just show days
            result = `${absDays}d`;
        }

        return result;
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

    onTaskClick(task: TaskWithPhase): void {
        if (!task.taskId || !task.phaseId) {
            console.warn('Missing identifiers for task details modal', task);
            return;
        }

        this.selectedTaskForDetails.set({
            taskId: task.taskId,
            phaseId: task.phaseId
        });
        this.showTaskDetailsModal.set(true);
    }

    closeTaskDetailsModal(): void {
        this.showTaskDetailsModal.set(false);
        this.selectedTaskForDetails.set(null);
    }

    onTaskDetailsUpdated(): void {
        this.loadTasks();
    }

    openCreateTaskModal(): void {
        this.showCreateTaskModal.set(true);
    }

    closeCreateTaskModal(): void {
        this.showCreateTaskModal.set(false);
    }

    getEmptyTask(): Task {
        return {
            taskName: '',
            description: '',
            startDate: '',
            endDate: '',
            status: 'OPEN',
            priority: 'Medium'
        };
    }

    onTaskSubmit(task: Task): void {
        const projectId = this.projectId();
        if (!projectId || !task.projectPhaseId) {
            console.error('Missing project ID or phase ID');
            return;
        }

        const url = `${environment.apiUrl}/project/${projectId}/phases/${task.projectPhaseId}/tasks`;
        this.http.post<Task>(url, task).subscribe({
            next: () => {
                this.loadTasks();
                this.closeCreateTaskModal();
                // Notify other components that tasks have been updated
                this.dataSyncService.notifyTasksUpdated(projectId, task.projectPhaseId!);
            },
            error: (err) => {
                console.error('Error creating task:', err);
            }
        });
    }

    // Subtask expansion methods
    toggleTaskExpansion(taskId: number, event: Event): void {
        event.stopPropagation();
        const expanded = this.expandedTaskIds();
        const newExpanded = new Set(expanded);
        if (newExpanded.has(taskId)) {
            newExpanded.delete(taskId);
        } else {
            newExpanded.add(taskId);
        }
        this.expandedTaskIds.set(newExpanded);
    }

    isTaskExpanded(taskId: number): boolean {
        return this.expandedTaskIds().has(taskId);
    }

    hasSubtasks(task: TaskWithPhase): boolean {
        return task.subTasks !== undefined && task.subTasks !== null && task.subTasks.length > 0;
    }

    onSubtaskClick(task: TaskWithPhase, subTaskId: number, event: Event): void {
        event.stopPropagation();
        if (!task.taskId || !task.phaseId) {
            console.warn('Missing identifiers for subtask details modal', task);
            return;
        }

        this.selectedSubtask.set({
            taskId: task.taskId,
            phaseId: task.phaseId,
            subTaskId: subTaskId
        });
        this.showSubtaskModal.set(true);
    }

    closeSubtaskModal(): void {
        this.showSubtaskModal.set(false);
        this.selectedSubtask.set(null);
    }

    onSubtaskUpdated(): void {
        this.loadTasks();
    }

    getSubtaskPriorityColor(priority: string): string {
        const colorMap: { [key: string]: string } = {
            'High': 'bg-red-500',
            'Medium': 'bg-yellow-500',
            'Low': 'bg-gray-400'
        };
        return colorMap[priority] || 'bg-gray-400';
    }

    // Sorting methods
    sortBy(column: string): void {
        if (this.sortColumn() === column) {
            // Toggle direction if same column
            this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to ascending
            this.sortColumn.set(column);
            this.sortDirection.set('asc');
        }
    }

    getSortIcon(column: string): string {
        if (this.sortColumn() !== column) return '';
        return this.sortDirection() === 'asc' ? '↑' : '↓';
    }

    // Check if a member is inactive (removed from project)
    isMemberRemoved(memberId?: number | string): boolean {
        if (!memberId) return false;
        const member = this.projectMembers().find(m => m.memberId === memberId);
        return member ? !member.isActive : false;
    }

    // ─── Bulk Selection ───────────────────────────────────────────────────────

    toggleTaskSelection(taskId: number, event: Event): void {
        event.stopPropagation();
        const current = new Set(this.selectedTaskIds());
        if (current.has(taskId)) {
            current.delete(taskId);
        } else {
            current.add(taskId);
        }
        this.selectedTaskIds.set(current);
    }

    toggleAllTasks(event: Event): void {
        event.stopPropagation();
        const tasks = this.sortedAndFilteredTasks();
        if (this.allVisibleSelected()) {
            this.selectedTaskIds.set(new Set());
        } else {
            const ids = new Set(tasks.map(t => t.taskId!).filter(id => id !== undefined));
            this.selectedTaskIds.set(ids);
        }
    }

    clearSelection(): void {
        this.selectedTaskIds.set(new Set());
    }

    isTaskSelected(taskId: number): boolean {
        return this.selectedTaskIds().has(taskId);
    }

    // ─── Bulk Edit Modal ──────────────────────────────────────────────────────

    openBulkEditModal(): void {
        this.bulkEditStatus.set('');
        this.bulkEditAssignee.set('');
        this.bulkEditPriority.set('');
        this.bulkEditStartDate.set('');
        this.bulkEditEndDate.set('');
        this.showBulkEditModal.set(true);
    }

    closeBulkEditModal(): void {
        this.showBulkEditModal.set(false);
    }

    onBulkEditStatusChange(event: Event): void {
        this.bulkEditStatus.set((event.target as HTMLSelectElement).value);
    }

    onBulkEditAssigneeChange(event: Event): void {
        this.bulkEditAssignee.set((event.target as HTMLSelectElement).value);
    }

    onBulkEditPriorityChange(event: Event): void {
        this.bulkEditPriority.set((event.target as HTMLSelectElement).value);
    }

    onBulkEditStartDateChange(event: Event): void {
        this.bulkEditStartDate.set((event.target as HTMLInputElement).value);
    }

    onBulkEditEndDateChange(event: Event): void {
        this.bulkEditEndDate.set((event.target as HTMLInputElement).value);
    }

    executeBulkEdit(): void {
        const ids = Array.from(this.selectedTaskIds());
        if (ids.length === 0) return;

        const updates: Record<string, any> = {};
        if (this.bulkEditStatus()) updates['status'] = this.bulkEditStatus();
        if (this.bulkEditAssignee()) updates['assignedToProjectMemberId'] = Number(this.bulkEditAssignee());
        if (this.bulkEditPriority()) updates['priority'] = this.bulkEditPriority();
        if (this.bulkEditStartDate()) {
            updates['startDate'] = this.bulkEditStartDate(); // Already yyyy-MM-dd from input
        }
        if (this.bulkEditEndDate()) {
            updates['endDate'] = this.bulkEditEndDate(); // Already yyyy-MM-dd from input
        }

        if (Object.keys(updates).length === 0) {
            this.closeBulkEditModal();
            return;
        }

        this.isBulkOperating.set(true);
        const url = `${environment.apiUrl}/project/${this.projectId()}/tasks/bulk-update`;
        this.http.put<BulkUpdateResponse>(url, { ids, updates }).subscribe({
            next: (res) => {
                this.isBulkOperating.set(false);
                this.closeBulkEditModal();
                this.clearSelection();
                this.loadTasks();
                this.dataSyncService.notifyTasksUpdated(this.projectId(), -1);
                const successCount = res.successIds?.length ?? ids.length;
                const failCount = res.failedItems?.length ?? 0;
                if (failCount === 0) {
                    this.showSnackbar(`${successCount} task${successCount !== 1 ? 's' : ''} updated successfully.`, 'success');
                } else {
                    this.showSnackbar(`${successCount} updated, ${failCount} failed.`, 'error');
                }
            },
            error: (err) => {
                console.error('Bulk update tasks error:', err);
                this.isBulkOperating.set(false);
                this.showSnackbar('Bulk update failed. Please try again.', 'error');
            }
        });
    }

    // ─── Bulk Delete Modal ────────────────────────────────────────────────────

    openBulkDeleteModal(): void {
        this.showBulkDeleteModal.set(true);
    }

    closeBulkDeleteModal(): void {
        this.showBulkDeleteModal.set(false);
    }

    executeBulkDelete(): void {
        const ids = Array.from(this.selectedTaskIds());
        if (ids.length === 0) return;

        this.isBulkOperating.set(true);
        const url = `${environment.apiUrl}/project/${this.projectId()}/tasks/bulk-delete`;
        this.http.delete<void>(url, { body: { ids } }).subscribe({
            next: () => {
                this.isBulkOperating.set(false);
                this.closeBulkDeleteModal();
                const count = ids.length;
                this.clearSelection();
                this.loadTasks();
                this.dataSyncService.notifyTasksUpdated(this.projectId(), -1);
                this.showSnackbar(`${count} task${count !== 1 ? 's' : ''} deleted successfully.`, 'success');
            },
            error: (err) => {
                console.error('Bulk delete tasks error:', err);
                this.isBulkOperating.set(false);
                this.showSnackbar('Bulk delete failed. Please try again.', 'error');
            }
        });
    }

    // ─── Snackbar ─────────────────────────────────────────────────────────────

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

    // ─── Bulk Add to Delay Tracker ────────────────────────────────────────────

    openBulkDelayModal(): void {
        this.bulkDelayRevisedEndDate.set('');
        this.bulkDelayReason.set('');
        this.showBulkDelayModal.set(true);
        this.cdr.markForCheck();
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
        const eligible = this.bulkDelayEligibleTasks();
        if (eligible.length === 0) return;

        const revisedEndDate = this.bulkDelayRevisedEndDate();
        const reason = this.bulkDelayReason();
        if (!revisedEndDate || !reason.trim()) return;

        const delayLogs = eligible.map(task => ({
            projectId: this.projectId(),
            phaseId: task.phaseId!,
            taskId: task.taskId!,
            entityType: 'TASK' as const,
            originalEndDate: this.formatDateToIso(task.endDate),
            revisedEndDate,
            status: (task.status === 'COMPLETED' ? 'COMPLETED' : 'ONGOING') as any,
            assigneeId: task.assignedToProjectMemberId ? Number(task.assignedToProjectMemberId) : undefined,
            reason
        }));

        this.isBulkOperating.set(true);
        this.cdr.markForCheck();
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
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Bulk add delay error:', err);
                this.isBulkOperating.set(false);
                this.showSnackbar('Failed to add delay entries. Please try again.', 'error');
                this.cdr.markForCheck();
            }
        });
    }

    /** Convert backend date (dd-MM-yyyy or yyyy-MM-dd) to ISO yyyy-MM-dd for API */
    private formatDateToIso(dateStr: string | undefined): string {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3 && parts[0].length === 2) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateStr.substring(0, 10);
    }
}

