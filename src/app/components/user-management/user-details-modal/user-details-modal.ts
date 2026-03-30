import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy } from '@angular/core';
import { User, UserManagementService } from '../../../services/user-management.service';
import { ProjectService } from '../../../services/project.service';
import { Phase, Task } from '../../../models/phase.model';
import { ProjectMember } from '../../../models/project.model';
import { PhaseDetailsModalComponent } from '../../phases/phase-details-modal/phase-details-modal';
import { TaskDetailsModalComponent } from '../../phases/task-details-modal/task-details-modal';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface HistoryPhase {
    projectName: string;
    projectId: number;
    phaseId: number;
    phaseName: string;
    status: string;
    startDate?: string;
    endDate?: string;
    completedOn?: string;
    taskCount: number;
}

interface HistoryTask {
    projectName: string;
    projectId: number;
    phaseId: number;
    taskId: number;
    phaseName: string;
    taskName: string;
    status: string;
    priority: string;
    startDate?: string;
    endDate?: string;
    completedOn?: string;
}

interface WeekOption {
    label: string;
    start: Date;
    end: Date;
}

@Component({
    selector: 'app-user-details-modal',
    imports: [CommonModule, PhaseDetailsModalComponent, TaskDetailsModalComponent],
    templateUrl: './user-details-modal.html',
    styleUrl: './user-details-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetailsModalComponent {
    private userManagementService = inject(UserManagementService);
    private projectService = inject(ProjectService);

    // Inputs
    isOpen = input.required<boolean>();
    userId = input.required<number>();
    user = input.required<User>();

    // Outputs
    close = output<void>();
    projectClick = output<{ projectId: number; memberId: string }>();

    // State
    loading = signal(false);
    error = signal<string | null>(null);
    projectMemberships = signal<any[]>([]);

    // History state
    historyLoading = signal(false);
    allHistoryPhases = signal<HistoryPhase[]>([]);
    allHistoryTasks = signal<HistoryTask[]>([]);
    activeHistoryTab = signal<'phases' | 'tasks'>('phases');
    selectedWeekIndex = signal<number>(-1); // -1 = All Weeks

    // Phase/Task detail modal state
    showPhaseDetailModal = signal(false);
    selectedPhase = signal<HistoryPhase | null>(null);
    showTaskDetailModal = signal(false);
    selectedTask = signal<HistoryTask | null>(null);
    // Members for the currently selected project (for the detail modals)
    selectedProjectMembers = signal<ProjectMember[]>([]);

    // Computed: generate week options from all dates
    weekOptions = computed<WeekOption[]>(() => {
        const phases = this.allHistoryPhases();
        const tasks = this.allHistoryTasks();
        const allDates: Date[] = [];

        for (const p of phases) {
            if (p.startDate) { const d = this.parseDate(p.startDate); if (d) allDates.push(d); }
            if (p.endDate) { const d = this.parseDate(p.endDate); if (d) allDates.push(d); }
        }
        for (const t of tasks) {
            if (t.startDate) { const d = this.parseDate(t.startDate); if (d) allDates.push(d); }
            if (t.endDate) { const d = this.parseDate(t.endDate); if (d) allDates.push(d); }
        }

        if (allDates.length === 0) return [];

        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

        const startMonday = this.getMonday(minDate);
        const endMonday = this.getMonday(maxDate);

        const weeks: WeekOption[] = [];
        const current = new Date(startMonday);
        while (current <= endMonday) {
            const weekStart = new Date(current);
            const weekEnd = new Date(current);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weeks.push({
                label: this.getWeekLabel(weekStart, weekEnd),
                start: weekStart,
                end: weekEnd
            });
            current.setDate(current.getDate() + 7);
        }
        return weeks.reverse(); // Most recent first
    });

    filteredHistoryPhases = computed(() => {
        const phases = this.allHistoryPhases();
        const weekIdx = this.selectedWeekIndex();
        const weeks = this.weekOptions();
        if (weekIdx < 0 || weekIdx >= weeks.length) return phases;
        const week = weeks[weekIdx];
        return phases.filter(p => this.dateRangeOverlapsWeek(p.startDate, p.endDate, week.start, week.end));
    });

    filteredHistoryTasks = computed(() => {
        const tasks = this.allHistoryTasks();
        const weekIdx = this.selectedWeekIndex();
        const weeks = this.weekOptions();
        if (weekIdx < 0 || weekIdx >= weeks.length) return tasks;
        const week = weeks[weekIdx];
        return tasks.filter(t => this.dateRangeOverlapsWeek(t.startDate, t.endDate, week.start, week.end));
    });

    hasHistory = computed(() => this.allHistoryPhases().length > 0 || this.allHistoryTasks().length > 0);

    constructor() {
        effect(() => {
            const id = this.userId();
            const isOpenState = this.isOpen();
            if (id && isOpenState) {
                this.loadUserProjects();
            }
        }, { allowSignalWrites: true });
    }

    loadUserProjects(): void {
        this.loading.set(true);
        this.error.set(null);

        this.userManagementService.getUserProjectMemberships(this.userId()).subscribe({
            next: (memberships) => {
                if (!memberships.length) {
                    this.projectMemberships.set([]);
                    this.loading.set(false);
                    this.allHistoryPhases.set([]);
                    this.allHistoryTasks.set([]);
                    return;
                }

                const projectRequests = memberships.map((m: any) =>
                    this.projectService.getProjectById(m.projectId).pipe(catchError(() => of(null)))
                );

                forkJoin(projectRequests).subscribe({
                    next: (projects) => {
                        const enriched = memberships.map((m: any, i: number) => {
                            const proj = projects[i] as any;
                            return {
                                ...m,
                                clientName: proj?.client ?? null,
                                startDate: proj?.startDate ?? null,
                                endDate: proj?.endDate ?? null,
                            };
                        });
                        this.projectMemberships.set(enriched);
                        this.loading.set(false);
                        this.loadAssignmentHistory(enriched);
                    },
                    error: () => {
                        this.projectMemberships.set(memberships);
                        this.loading.set(false);
                        this.loadAssignmentHistory(memberships);
                    }
                });
            },
            error: (err) => {
                console.error('Error loading user projects:', err);
                this.error.set('Failed to load user projects');
                this.loading.set(false);
            }
        });
    }

    private loadAssignmentHistory(memberships: any[]): void {
        if (!memberships.length) return;
        this.historyLoading.set(true);

        const phaseRequests = memberships.map((m: any) =>
            this.projectService.getPhases(m.projectId).pipe(catchError(() => of([] as Phase[])))
        );

        forkJoin(phaseRequests).subscribe({
            next: (allProjectPhases) => {
                const historyPhases: HistoryPhase[] = [];
                const historyTasks: HistoryTask[] = [];

                allProjectPhases.forEach((phases, idx) => {
                    const membership = memberships[idx];
                    const memberIdNum = typeof membership.memberId === 'string'
                        ? parseInt(membership.memberId, 10)
                        : membership.memberId;
                    const projectName = membership.project || `Project ${membership.projectId}`;

                    phases.forEach(phase => {
                        if (phase.projectMemberId === memberIdNum) {
                            historyPhases.push({
                                projectName,
                                projectId: membership.projectId,
                                phaseId: phase.phaseId!,
                                phaseName: phase.phaseName,
                                status: phase.status || 'OPEN',
                                startDate: phase.startDate,
                                endDate: phase.endDate,
                                completedOn: phase.completedOn,
                                taskCount: phase.tasks?.length || 0
                            });
                        }

                        phase.tasks?.forEach(task => {
                            if (task.assignedToProjectMemberId === memberIdNum) {
                                historyTasks.push({
                                    projectName,
                                    projectId: membership.projectId,
                                    phaseId: phase.phaseId!,
                                    taskId: task.taskId!,
                                    phaseName: phase.phaseName,
                                    taskName: task.taskName,
                                    status: task.status || 'OPEN',
                                    priority: task.priority || 'Low',
                                    startDate: task.startDate,
                                    endDate: task.endDate,
                                    completedOn: task.completedOn
                                });
                            }
                        });
                    });
                });

                this.allHistoryPhases.set(historyPhases);
                this.allHistoryTasks.set(historyTasks);

                if (historyPhases.length === 0 && historyTasks.length > 0) {
                    this.activeHistoryTab.set('tasks');
                } else {
                    this.activeHistoryTab.set('phases');
                }

                this.historyLoading.set(false);
            },
            error: () => {
                this.historyLoading.set(false);
            }
        });
    }

    // ── Detail modal openers ──────────────────────────────────────────────────

    onPhaseRowClick(phase: HistoryPhase): void {
        this.selectedPhase.set(phase);
        this.loadProjectMembersAndOpen('phase', phase.projectId);
    }

    onTaskRowClick(task: HistoryTask): void {
        this.selectedTask.set(task);
        this.loadProjectMembersAndOpen('task', task.projectId);
    }

    private loadProjectMembersAndOpen(type: 'phase' | 'task', projectId: number): void {
        this.projectService.getProjectMembers(projectId).pipe(
            catchError(() => of([] as ProjectMember[]))
        ).subscribe(members => {
            this.selectedProjectMembers.set(members);
            if (type === 'phase') {
                this.showPhaseDetailModal.set(true);
            } else {
                this.showTaskDetailModal.set(true);
            }
        });
    }

    closePhaseDetailModal(): void {
        this.showPhaseDetailModal.set(false);
        this.selectedPhase.set(null);
    }

    closeTaskDetailModal(): void {
        this.showTaskDetailModal.set(false);
        this.selectedTask.set(null);
    }

    // ── History Tab / Week ────────────────────────────────────────────────────

    switchHistoryTab(tab: 'phases' | 'tasks'): void {
        this.activeHistoryTab.set(tab);
    }

    onWeekChange(event: Event): void {
        const value = (event.target as HTMLSelectElement).value;
        this.selectedWeekIndex.set(parseInt(value, 10));
    }

    // ── Completion status helper ──────────────────────────────────────────────

    /**
     * Returns a label + CSS colour class for the completion status badge:
     * - COMPLETED: "Xd early", "On time", or "+Xd late"
     * - Active past end date: "Overdue Xd"
     * - Otherwise: null (no badge)
     */
    getCompletionStatus(item: HistoryPhase | HistoryTask): { label: string; colorClass: string } | null {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (item.status === 'COMPLETED') {
            if (item.completedOn && item.endDate) {
                const completedDate = this.parseDate(item.completedOn);
                const endDate = this.parseDate(item.endDate);
                if (completedDate && endDate) {
                    completedDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    if (completedDate <= endDate) {
                        const earlyDays = Math.floor((endDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (earlyDays > 0) {
                            return { label: `${this.formatDurationText(earlyDays)} early`, colorClass: 'text-green-700 bg-green-50' };
                        }
                        return { label: 'On time', colorClass: 'text-green-700 bg-green-50' };
                    } else {
                        const lateDays = Math.ceil((completedDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
                        return { label: `+${this.formatDurationText(lateDays)} late`, colorClass: 'text-red-600 bg-red-50' };
                    }
                }
            }
            return null;
        }

        if (item.status === 'CANCELLED') return null;

        if (item.endDate) {
            const endDate = this.parseDate(item.endDate);
            if (endDate) {
                endDate.setHours(0, 0, 0, 0);
                if (today > endDate) {
                    const overdueDays = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
                    return { label: `Overdue ${this.formatDurationText(overdueDays)}`, colorClass: 'text-orange-600 bg-orange-50' };
                }
            }
        }

        return null;
    }

    private formatDurationText(days: number): string {
        if (days === 0) return '0d';
        const abs = Math.abs(days);
        if (abs >= 365) {
            const y = Math.floor(abs / 365);
            const m = Math.floor((abs % 365) / 30);
            return m > 0 ? `${y}y${m}m` : `${y}y`;
        }
        if (abs >= 30) {
            const m = Math.floor(abs / 30);
            const w = Math.floor((abs % 30) / 7);
            return w > 0 ? `${m}m${w}w` : `${m}m`;
        }
        if (abs >= 7) {
            const w = Math.floor(abs / 7);
            const d = abs % 7;
            return d > 0 ? `${w}w${d}d` : `${w}w`;
        }
        return `${abs}d`;
    }

    // ── General helpers ───────────────────────────────────────────────────────

    onClose(): void {
        this.close.emit();
    }

    getInitials(name?: string): string {
        if (!name) return 'NA';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
        }
        return name.charAt(0).toUpperCase();
    }

    getAvatarColor(userId: number): string {
        const colors = [
            'from-purple-500 to-pink-500',
            'from-blue-500 to-cyan-500',
            'from-green-500 to-teal-500',
            'from-orange-500 to-red-500',
            'from-pink-500 to-rose-500'
        ];
        return `bg-gradient-to-br ${colors[userId % colors.length]}`;
    }

    getGlobalRoleColorClass(role: string): string {
        const colorMap: { [key: string]: string } = {
            'SUPER ADMIN': 'bg-purple-100 text-purple-800',
            'ADMIN': 'bg-blue-100 text-blue-800',
            'MEMBER': 'bg-gray-100 text-gray-800'
        };
        return colorMap[role] || 'bg-gray-100 text-gray-800';
    }

    getProjectRoleColorClass(role: string): string {
        const colorMap: { [key: string]: string } = {
            'SUPER_ADMIN': 'bg-purple-100 text-purple-800',
            'PROJECT_HEAD': 'bg-[#8c2d1b] text-white',
            'PROJECT_HANDLER': 'bg-blue-100 text-blue-700',
            'PROJECT_VIEWER': 'bg-gray-100 text-gray-700'
        };
        return colorMap[role.toUpperCase().replace(' ', '_')] || 'bg-gray-100 text-gray-700';
    }

    getProjectRoleLabel(role: string): string {
        const roleMap: { [key: string]: string } = {
            'SUPER_ADMIN': 'Super Admin',
            'PROJECT_HEAD': 'Head',
            'PROJECT_HANDLER': 'Handler',
            'PROJECT_VIEWER': 'Viewer'
        };
        return roleMap[role.toUpperCase().replace(' ', '_')] || role;
    }

    getStatusClass(status: string): string {
        const statusMap: { [key: string]: string } = {
            'OPEN': 'bg-gray-100 text-gray-800',
            'ONGOING': 'bg-blue-100 text-blue-800',
            'ON_HOLD': 'bg-yellow-100 text-yellow-800',
            'COMPLETED': 'bg-green-100 text-green-800'
        };
        return statusMap[status] || 'bg-gray-100 text-gray-800';
    }

    getStatusLabel(status: string): string {
        const labelMap: { [key: string]: string } = {
            'OPEN': 'Open',
            'ONGOING': 'Ongoing',
            'ON_HOLD': 'On Hold',
            'COMPLETED': 'Completed'
        };
        return labelMap[status] || status;
    }

    getPriorityClass(priority: string): string {
        const priorityMap: { [key: string]: string } = {
            'Low': 'text-gray-600',
            'Medium': 'text-yellow-600',
            'High': 'text-red-600'
        };
        return priorityMap[priority] || 'text-gray-600';
    }

    formatDate(dateString: string | undefined): string {
        if (!dateString) return 'N/A';
        try {
            const date = this.parseDate(dateString);
            if (!date) return 'N/A';
            return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
        } catch {
            return dateString;
        }
    }

    formatDuration(startDate: string | undefined, endDate: string | undefined): string {
        if (!startDate && !endDate) return '—';
        const fmt = (d: string) => {
            const date = this.parseDate(d);
            if (!date) return '—';
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        };
        if (startDate && endDate) return `${fmt(startDate)} – ${fmt(endDate)}`;
        if (startDate) return `From ${fmt(startDate)}`;
        return `Until ${fmt(endDate!)}`;
    }

    private parseDate(dateString: string): Date | null {
        if (!dateString) return null;
        const ddMMyyyy = /^(\d{2})-(\d{2})-(\d{4})$/;
        const match = dateString.match(ddMMyyyy);
        if (match) {
            return new Date(+match[3], +match[2] - 1, +match[1]);
        }
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    private getMonday(date: Date): Date {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    private getWeekLabel(start: Date, end: Date): string {
        const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
    }

    private dateRangeOverlapsWeek(
        startStr: string | undefined,
        endStr: string | undefined,
        weekStart: Date,
        weekEnd: Date
    ): boolean {
        const itemStart = startStr ? this.parseDate(startStr) : null;
        const itemEnd = endStr ? this.parseDate(endStr) : null;
        if (!itemStart && !itemEnd) return true;
        const effectiveStart = itemStart || itemEnd!;
        const effectiveEnd = itemEnd || itemStart!;
        return effectiveStart <= weekEnd && effectiveEnd >= weekStart;
    }

    onProjectRowClick(membership: any): void {
        this.projectClick.emit({
            projectId: membership.projectId,
            memberId: membership.memberId
        });
    }
}
