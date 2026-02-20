import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy } from '@angular/core';
import { ProjectMember } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { Phase, Task, SubTask } from '../../../models/phase.model';

interface AssignedPhase extends Phase {
    // Additional computed fields if needed
}

interface AssignedTask extends Task {
    phaseName: string;
}

interface AssignedSubTask extends SubTask {
    taskName: string;
    phaseName: string;
}

@Component({
    selector: 'app-member-details-modal',
    imports: [CommonModule],
    templateUrl: './member-details-modal.html',
    styleUrl: './member-details-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberDetailsModalComponent {
    private projectService = inject(ProjectService);

    // Inputs
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    memberId = input.required<string>();
    projectMembers = input<ProjectMember[]>([]);

    // Outputs
    close = output<void>();

    // State
    loading = signal(false);
    error = signal<string | null>(null);
    activeTab = signal<'phases' | 'tasks' | 'subtasks'>('phases');

    // Data
    assignedPhases = signal<AssignedPhase[]>([]);
    assignedTasks = signal<AssignedTask[]>([]);
    assignedSubtasks = signal<AssignedSubTask[]>([]);

    // Computed values
    memberDetails = computed(() => {
        const members = this.projectMembers();
        const id = this.memberId();
        return members.find(m => m.memberId === id) || null;
    });

    hasAssignedPhases = computed(() => this.assignedPhases().length > 0);
    hasAssignedTasks = computed(() => this.assignedTasks().length > 0);
    hasAssignedSubtasks = computed(() => this.assignedSubtasks().length > 0);

    hasAnyAssignments = computed(() =>
        this.hasAssignedPhases() || this.hasAssignedTasks() || this.hasAssignedSubtasks()
    );

    // Set default tab to first available category
    defaultTab = computed(() => {
        if (this.hasAssignedPhases()) return 'phases';
        if (this.hasAssignedTasks()) return 'tasks';
        if (this.hasAssignedSubtasks()) return 'subtasks';
        return 'phases';
    });

    constructor() {
        effect(() => {
            const id = this.memberId();
            const projectId = this.projectId();
            const isOpenState = this.isOpen();

            if (id && projectId && isOpenState) {
                this.loadMemberData();
            }
        }, { allowSignalWrites: true });
    }

    loadMemberData(): void {
        this.loading.set(true);
        this.error.set(null);

        const memberIdNum = typeof this.memberId() === 'string'
            ? parseInt(this.memberId(), 10)
            : this.memberId();

        this.projectService.getPhases(this.projectId()).subscribe({
            next: (phases) => {
                const member = this.memberDetails();

                // Don't show assignments for PROJECT_VIEWER
                if (member?.role === 'PROJECT_VIEWER') {
                    this.assignedPhases.set([]);
                    this.assignedTasks.set([]);
                    this.assignedSubtasks.set([]);
                    this.loading.set(false);
                    return;
                }

                // Filter phases assigned to this member
                const assignedPhases = phases.filter(p =>
                    p.projectMemberId === memberIdNum
                );
                this.assignedPhases.set(assignedPhases);

                // Extract all tasks assigned to this member
                const assignedTasks: AssignedTask[] = [];
                const assignedSubtasks: AssignedSubTask[] = [];

                phases.forEach(phase => {
                    phase.tasks?.forEach(task => {
                        if (task.assignedToProjectMemberId === memberIdNum) {
                            assignedTasks.push({
                                ...task,
                                phaseName: phase.phaseName
                            });
                        }

                        // Check subtasks
                        task.subTasks?.forEach(subtask => {
                            if (subtask.assignedToProjectMemberId === memberIdNum) {
                                assignedSubtasks.push({
                                    ...subtask,
                                    taskName: task.taskName,
                                    phaseName: phase.phaseName
                                });
                            }
                        });
                    });
                });

                this.assignedTasks.set(assignedTasks);
                this.assignedSubtasks.set(assignedSubtasks);

                // Set active tab to first available category
                this.activeTab.set(this.defaultTab());

                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error loading member data:', err);
                this.error.set('Failed to load member data');
                this.loading.set(false);
            }
        });
    }

    onClose(): void {
        this.close.emit();
    }

    switchTab(tab: 'phases' | 'tasks' | 'subtasks'): void {
        this.activeTab.set(tab);
    }

    getInitials(name?: string): string {
        if (!name) return 'NA';
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    getAvatarColor(memberId: string | number): string {
        const colors = [
            'from-indigo-500 to-purple-600',
            'from-green-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-pink-500 to-rose-600',
            'from-blue-500 to-cyan-600'
        ];
        const id = typeof memberId === 'string' ? parseInt(memberId, 10) : memberId;
        const index = (id || 0) % colors.length;
        return `bg-gradient-to-br ${colors[index]}`;
    }

    getRoleBadgeClass(role: string): string {
        const colorMap: { [key: string]: string } = {
            'SUPER_ADMIN': 'bg-purple-100 text-purple-800',
            'PROJECT_HEAD': 'bg-[#8c2d1b] text-white',
            'PROJECT_HANDLER': 'bg-blue-100 text-blue-700',
            'PROJECT_VIEWER': 'bg-gray-100 text-gray-700'
        };
        return colorMap[role.toUpperCase().replace(' ', '_')] || 'bg-gray-100 text-gray-700';
    }

    getRoleLabel(role: string): string {
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
        // Backend returns DD-MM-YYYY format
        const parts = dateString.split('-');
        if (parts.length === 3) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthIndex = parseInt(parts[1], 10) - 1;
            return `${months[monthIndex]} ${parseInt(parts[0], 10)}, ${parts[2]}`;
        }
        return dateString;
    }
}
