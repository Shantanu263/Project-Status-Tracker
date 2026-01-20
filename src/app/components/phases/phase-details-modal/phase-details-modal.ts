import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { ProjectMember } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { PermissionService } from '../../../services/permission.service';
import { AuthService } from '../../../services/auth.service';
import { Phase, Task } from '../../../models/phase.model';
import { TaskDetailsModalComponent } from '../task-details-modal/task-details-modal';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DataSyncService } from '../../../services/data-sync.service';


@Component({
    selector: 'app-phase-details-modal',
    imports: [CommonModule, FormsModule, TaskDetailsModalComponent],
    templateUrl: './phase-details-modal.html',
    styleUrl: './phase-details-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhaseDetailsModalComponent {
    private projectService = inject(ProjectService);
    private permissionService = inject(PermissionService);
    private authService = inject(AuthService);
    private snackBar = inject(MatSnackBar);
    private dataSyncService = inject(DataSyncService);


    // Inputs
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    phaseId = input.required<number>();
    projectMembers = input<ProjectMember[]>([]);

    // Outputs
    close = output<void>();
    updated = output<void>();

    // State
    phaseDetails = signal<Phase | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);
    editingField = signal<string | null>(null);
    showMemberDropdown = signal(false);
    showMoreMenu = signal(false);
    showDeleteConfirmation = signal(false);

    // Task modal state
    showTaskDetailsModal = signal(false);
    selectedTaskId = signal<number | null>(null);

    // Permission signals
    currentUserId = computed(() => this.authService.getCurrentUserId());

    canUpdatePhase = computed(() =>
        this.permissionService.canUpdatePhase(this.projectMembers(), this.currentUserId())
    );

    canDeletePhase = computed(() =>
        this.permissionService.canDeletePhase(this.projectMembers(), this.currentUserId())
    );

    // Computed values
    assignedMember = computed(() => {
        const phase = this.phaseDetails();
        const members = this.projectMembers();
        if (!phase || !phase.projectMemberId) return null;
        return members.find(m => m.memberId === phase.projectMemberId) || null;
    });

    activeProjectMembers = computed(() => this.projectMembers().filter(member => member.isActive));

    phaseTasks = computed(() => {
        const phase = this.phaseDetails();
        return phase?.tasks || [];
    });

    completedTasksCount = computed(() => {
        return this.phaseTasks().filter(t => t.status === 'DONE').length;
    });

    progressPercentage = computed(() => {
        const tasks = this.phaseTasks();
        if (tasks.length === 0) return 0;
        return Math.round((this.completedTasksCount() / tasks.length) * 100);
    });

    constructor() {
        effect(() => {
            const phaseId = this.phaseId();
            const projectId = this.projectId();
            // Only load when phaseId or projectId changes, not when isOpen changes
            if (phaseId && projectId) {
                this.loadPhaseDetails();
            }
        }, { allowSignalWrites: true });
    }

    loadPhaseDetails(): void {
        this.loading.set(true);
        this.error.set(null);

        this.projectService.getPhases(this.projectId()).subscribe({
            next: (phases) => {
                const phase = phases.find(p => p.phaseId === this.phaseId());
                if (phase) {
                    this.phaseDetails.set(phase);
                } else {
                    this.error.set('Phase not found');
                }
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Error loading phase details:', err);
                this.error.set('Failed to load phase details');
                this.loading.set(false);
            }
        });
    }

    onClose(): void {
        this.close.emit();
    }

    toggleMoreMenu(): void {
        this.showMoreMenu.update(v => !v);
    }

    openDeleteConfirmation(): void {
        this.showMoreMenu.set(false);
        this.showDeleteConfirmation.set(true);
    }

    closeDeleteConfirmation(): void {
        this.showDeleteConfirmation.set(false);
    }

    confirmDelete(): void {
        this.projectService.deletePhase(this.projectId(), this.phaseId()).subscribe({
            next: () => {
                this.showDeleteConfirmation.set(false);
                this.close.emit();
                // Notify parent to refresh the list
                this.updated.emit();
                // Notify other components that phases have been updated
                this.dataSyncService.notifyPhasesUpdated(this.projectId());
            },
            error: (err) => {
                console.error('Error deleting phase:', err);
                this.error.set('Failed to delete phase');
                this.showDeleteConfirmation.set(false);
            }
        });
        // Show success notification
        this.snackBar.open('Phase deleted successfully!', 'Close', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
        });
    }

    startEditing(field: string): void {
        this.editingField.set(field);
    }

    cancelEditing(): void {
        this.editingField.set(null);
    }

    updatePhaseName(newValue: string): void {
        if (!newValue.trim()) return;
        this.updateField('phaseName', newValue);
        this.editingField.set(null);
    }

    updateDescription(newValue: string): void {
        this.updateField('description', newValue);
        this.editingField.set(null);
    }

    updateStatus(newStatus: string): void {
        this.updateField('status', newStatus);
    }

    updateAssignedMember(memberId: number | null): void {
        this.updateField('projectMemberId', memberId);
    }

    updateStartDate(newDate: string): void {
        // Date is already in YYYY-MM-DD format from input[type="date"]
        this.updateField('startDate', newDate);
    }

    updateEndDate(newDate: string): void {
        // Date is already in YYYY-MM-DD format from input[type="date"]
        this.updateField('endDate', newDate);
    }

    private updateField(field: string, value: any): void {
        const updates: any = { [field]: value };

        // Immediately update the local state for instant feedback
        const currentPhase = this.phaseDetails();
        if (currentPhase) {
            this.phaseDetails.set({ ...currentPhase, [field]: value });
        }

        // Then update the backend
        this.projectService.updatePhase(
            this.projectId(),
            this.phaseId(),
            updates
        ).subscribe({
            next: (updatedPhase) => {
                // Merge backend response with current state
                const current = this.phaseDetails();
                if (current) {
                    this.phaseDetails.set({ ...current, ...updatedPhase });
                }
                // Notify other components that phases have been updated
                this.dataSyncService.notifyPhasesUpdated(this.projectId());
                // Don't emit updated event to prevent parent from reloading and closing modal
                // this.updated.emit();
            },
            error: (err) => {
                console.error('Error updating phase:', err);
                this.error.set(`Failed to update ${field}`);
                // Revert the optimistic update on error
                this.loadPhaseDetails();
            }
        });
    }

    toggleMemberDropdown(): void {
        this.showMemberDropdown.update(v => !v);
    }

    selectMember(member: ProjectMember): void {
        const memberId = typeof member.memberId === 'string' ? parseInt(member.memberId, 10) : member.memberId;
        this.updateAssignedMember(memberId || null);
        this.showMemberDropdown.set(false);
    }

    clearMemberSelection(): void {
        this.updateAssignedMember(null);
        this.showMemberDropdown.set(false);
    }

    getInitials(member: ProjectMember): string {
        const name = member.user || '';
        return name
            .split(' ')
            .map(word => word.charAt(0))
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    getAvatarColor(member: ProjectMember): string {
        const colors = [
            'from-indigo-500 to-purple-600',
            'from-green-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-pink-500 to-rose-600',
            'from-blue-500 to-cyan-600'
        ];
        const memberId = typeof member.memberId === 'string' ? parseInt(member.memberId, 10) : member.memberId;
        const index = (memberId || 0) % colors.length;
        return `bg-gradient-to-br ${colors[index]}`;
    }

    formatDate(dateString: string | undefined): string {
        if (!dateString) return '';
        // If already in YYYY-MM-DD format, return as is
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }
        // Backend returns DD-MM-YYYY, convert to YYYY-MM-DD for input[type="date"]
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString;
    }

    getStatusLabel(status?: string): string {
        const labelMap: { [key: string]: string } = {
            'TO_DO': 'To Do',
            'IN_PROGRESS': 'In Progress',
            'ON_HOLD': 'On Hold',
            'COMPLETED': 'Completed'
        };
        return labelMap[status || ''] || status || 'Not Set';
    }

    getTaskStatusClass(status: string): string {
        const statusMap: { [key: string]: string } = {
            'TO_DO': 'bg-gray-100 text-gray-800',
            'IN_PROGRESS': 'bg-blue-100 text-blue-800',
            'REVIEW': 'bg-purple-100 text-purple-800',
            'DONE': 'bg-green-100 text-green-800'
        };
        return statusMap[status] || 'bg-gray-100 text-gray-800';
    }

    getTaskStatusLabel(status: string): string {
        const labelMap: { [key: string]: string } = {
            'TO_DO': 'To Do',
            'IN_PROGRESS': 'In Progress',
            'REVIEW': 'Review',
            'DONE': 'Done'
        };
        return labelMap[status] || status;
    }

    getAssignedMemberForTask(memberId: number | undefined): ProjectMember | null {
        if (!memberId) return null;
        const members = this.projectMembers();
        return members.find(m => m.memberId === memberId) || null;
    }

    onTaskClick(taskId: number): void {
        this.selectedTaskId.set(taskId);
        this.showTaskDetailsModal.set(true);
    }

    closeTaskDetailsModal(): void {
        this.showTaskDetailsModal.set(false);
        this.selectedTaskId.set(null);
    }

    onTaskDetailsUpdated(): void {
        // Refresh phase details to get updated task information
        this.loadPhaseDetails();
    }
}
