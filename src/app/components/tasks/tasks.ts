import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
            tasks = tasks.filter(task => task.status === 'DONE');
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
                    const statusOrder = { 'TO_DO': 0, 'IN_PROGRESS': 1, 'REVIEW': 2, 'DONE': 3 };
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
        this.startDateFilter.set('');
        this.endDateFilter.set('');
    }

    getStatusClass(status?: string): string {
        switch (status) {
            case 'IN_PROGRESS':
                return 'bg-blue-100 text-blue-800';
            case 'DONE':
                return 'bg-green-100 text-green-800';
            case 'REVIEW':
                return 'bg-purple-100 text-purple-800';
            case 'TO_DO':
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    getStatusLabel(status?: string): string {
        switch (status) {
            case 'IN_PROGRESS':
                return 'In Progress';
            case 'DONE':
                return 'Done';
            case 'REVIEW':
                return 'Review';
            case 'TO_DO':
            default:
                return 'To Do';
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
        return status === 'DONE' ? 'text-green-500' : 'text-blue-500';
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
        if (task.status === 'DONE' && task.completedAt) {
            return this.formatDate(task.completedAt);
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

        if (task.status === 'DONE') {
            // For DONE tasks: check if completed on time or late
            if (task.completedAt && task.endDate) {
                const completedDate = this.parseDateFromBackend(task.completedAt);
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
            // Fallback for DONE tasks without proper dates
            return { label: '—', color: 'text-gray-600' };
        } else {
            // For non-DONE tasks: check if overdue
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
            status: 'TO_DO',
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
}
