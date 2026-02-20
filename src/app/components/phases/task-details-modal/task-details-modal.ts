import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { ProjectMember } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { PermissionService } from '../../../services/permission.service';
import { AuthService } from '../../../services/auth.service';
import { Task } from '../../../models/phase.model';
import { SubtaskDetailsModalComponent } from '../subtask-details-modal/subtask-details-modal';
import { SubtaskFormComponent } from '../subtask-form/subtask-form';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DataSyncService } from '../../../services/data-sync.service';



@Component({
    selector: 'app-task-details-modal',
    imports: [CommonModule, FormsModule, SubtaskDetailsModalComponent, SubtaskFormComponent],
    templateUrl: './task-details-modal.html',
    styleUrl: './task-details-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskDetailsModalComponent {
    private projectService = inject(ProjectService);
    private permissionService = inject(PermissionService);
    private authService = inject(AuthService);
    private snackBar = inject(MatSnackBar);
    private dataSyncService = inject(DataSyncService);


    // Inputs
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    phaseId = input.required<number>();
    taskId = input.required<number>();
    projectMembers = input<ProjectMember[]>([]);

    // Outputs
    close = output<void>();
    updated = output<void>();

    // State
    taskDetails = signal<Task | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);
    editingField = signal<string | null>(null);
    activeTab = signal<'history' | 'comments'>('history');
    showMemberDropdown = signal(false);
    showMoreMenu = signal(false);
    showDeleteConfirmation = signal(false);
    hasUnsavedChanges = signal(false); // Track if changes were made

    // Comment state
    editingCommentId = signal<number | null>(null);
    deletingCommentId = signal<number | null>(null);
    newCommentContent = signal<string>('');
    editCommentContent = signal<string>('');
    currentUserId = signal<number | null>(this.authService.getCurrentUserId());

    // Subtask modal state
    showSubtaskModal = signal(false);
    selectedSubtaskId = signal<number | null>(null);
    showSubtaskFormModal = signal(false);

    // Permission signals
    currentUserIdComputed = computed(() => this.authService.getCurrentUserId());

    canUpdateTask = computed(() =>
        this.permissionService.canUpdateTask(this.projectMembers(), this.currentUserIdComputed())
    );

    canDeleteTask = computed(() =>
        this.permissionService.canDeleteTask(this.projectMembers(), this.currentUserIdComputed())
    );

    canCreateSubtask = computed(() =>
        this.permissionService.canCreateTask(this.projectMembers(), this.currentUserIdComputed())
    );

    // Computed values
    assignedMember = computed(() => {
        const task = this.taskDetails();
        const members = this.projectMembers();
        if (!task || !task.assignedToProjectMemberId) return null;
        return members.find(m => m.memberId === task.assignedToProjectMemberId) || null;
    });

    activeProjectMembers = computed(() =>
        this.projectMembers().filter(member =>
            member.isActive && member.role !== 'PROJECT_VIEWER'
        )
    );

    recentLogs = computed(() => {
        const task = this.taskDetails();
        if (!task || !task.logs) return [];
        // Sort by createdAt descending and take first 5
        return [...task.logs]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
    });

    constructor() {
        effect(() => {
            const isOpenState = this.isOpen();
            if (isOpenState && this.projectId() && this.phaseId() && this.taskId()) {
                this.loadTaskDetails();
            }
            // Reset unsaved changes flag when modal opens
            if (isOpenState) {
                this.hasUnsavedChanges.set(false);
            }
        }, { allowSignalWrites: true });
    }

    loadTaskDetails(): void {
        this.loading.set(true);
        this.error.set(null);

        this.projectService.getTaskDetails(this.projectId(), this.phaseId(), this.taskId())
            .subscribe({
                next: (task) => {
                    this.taskDetails.set(task);
                    this.loading.set(false);
                },
                error: (err) => {
                    console.error('Error loading task details:', err);
                    this.error.set('Failed to load task details');
                    this.loading.set(false);
                }
            });
    }

    onClose(): void {
        // Only notify other components if changes were made
        if (this.hasUnsavedChanges()) {
            this.dataSyncService.notifyTasksUpdated(this.projectId(), this.phaseId());
            this.hasUnsavedChanges.set(false);
        }
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
        this.projectService.deleteTask(this.projectId(), this.phaseId(), this.taskId()).subscribe({
            next: () => {
                this.showDeleteConfirmation.set(false);
                this.close.emit();
                // Notify parent to refresh
                this.updated.emit();
                // Notify other components that tasks have been updated
                this.dataSyncService.notifyTasksUpdated(this.projectId(), this.phaseId());
            },
            error: (err) => {
                console.error('Error deleting task:', err);
                this.error.set('Failed to delete task');
                this.showDeleteConfirmation.set(false);
            }
        });
        // Show success notification
        this.snackBar.open('Task deleted successfully!', 'Close', {
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

    updateTaskName(newValue: string): void {
        if (!newValue.trim()) return;
        this.updateField('taskName', newValue);
        this.editingField.set(null);
    }

    updateDescription(newValue: string): void {
        this.updateField('description', newValue);
        this.editingField.set(null);
    }

    updateStatus(newStatus: string): void {
        this.updateField('status', newStatus);
    }

    updatePriority(newPriority: string): void {
        this.updateField('priority', newPriority);
    }

    updateAssignedMember(memberId: number | null): void {
        this.updateField('assignedToProjectMemberId', memberId);
    }

    updateStartDate(newDate: string): void {
        this.updateField('startDate', newDate);
    }

    updateEndDate(newDate: string): void {
        this.updateField('endDate', newDate);
    }

    private updateField(field: string, value: any): void {
        // Map frontend field names to backend API field names
        const fieldMapping: { [key: string]: string } = {
            'assignedToProjectMemberId': 'assignedTo'
        };

        const apiFieldName = fieldMapping[field] || field;
        const updates: any = { [apiFieldName]: value };

        // Immediately update the local state for instant feedback
        const currentTask = this.taskDetails();
        if (currentTask) {
            this.taskDetails.set({ ...currentTask, [field]: value });
        }

        // Then update the backend
        this.projectService.updateTask(
            this.projectId(),
            this.phaseId(),
            this.taskId(),
            updates
        ).subscribe({
            next: (updatedTask) => {
                // Merge backend response with current state (no full reload to avoid flickering)
                const current = this.taskDetails();
                if (current) {
                    this.taskDetails.set({ ...current, ...updatedTask });
                }
                // Mark that changes were made (will notify on modal close)
                this.hasUnsavedChanges.set(true);
                // Don't notify immediately to avoid reloading while modal is open
                // this.dataSyncService.notifyTasksUpdated(this.projectId(), this.phaseId());
            },
            error: (err) => {
                console.error('Error updating task:', err);
                this.error.set(`Failed to update ${field}`);
                // Revert the optimistic update on error
                this.loadTaskDetails();
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
        // Backend returns DD-MM-YYYY, convert to YYYY-MM-DD for input[type="date"]
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString;
    }

    formatDateForBackend(dateString: string | undefined): string {
        if (!dateString) return '';
        // Convert YYYY-MM-DD to DD-MM-YYYY for backend
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString;
    }

    getTimeAgo(dateString: string): string {
        const now = new Date();
        const past = new Date(dateString);
        const diffMs = now.getTime() - past.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffWeeks = Math.floor(diffDays / 7);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffSeconds < 60) {
            return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
        } else if (diffMinutes < 60) {
            return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else if (diffWeeks < 4) {
            return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
        } else if (diffMonths < 12) {
            return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
        } else {
            return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
        }
    }

    getAuthorInitials(authorName: string): string {
        if (!authorName) return '??';
        const parts = authorName.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return authorName.substring(0, 2).toUpperCase();
    }

    extractAuthorName(message: string): string {
        // Extract author name from message like "Admin changed Task status..."
        const match = message.match(/^([^\s]+)/);
        return match ? match[1] : 'Unknown';
    }

    getLogAvatarColor(index: number): string {
        const colors = [
            'from-indigo-500 to-purple-600',
            'from-green-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-pink-500 to-rose-600',
            'from-blue-500 to-cyan-600'
        ];
        return colors[index % colors.length];
    }

    // Comment operations
    addComment(): void {
        const content = this.newCommentContent().trim();
        if (!content) return;

        this.projectService.addComment(this.taskId(), content).subscribe({
            next: (newComment) => {
                // Add new comment to the list
                const currentTask = this.taskDetails();
                if (currentTask) {
                    const updatedComments = [...(currentTask.comments || []), newComment];
                    this.taskDetails.set({ ...currentTask, comments: updatedComments });
                }
                this.newCommentContent.set('');
            },
            error: (err) => {
                console.error('Error adding comment:', err);
                this.error.set('Failed to add comment');
            }
        });
    }

    startEditingComment(comment: any): void {
        this.editingCommentId.set(comment.id);
        this.editCommentContent.set(comment.content);
    }

    saveCommentEdit(commentId: number): void {
        const content = this.editCommentContent().trim();
        if (!content) return;

        this.projectService.updateComment(commentId, content).subscribe({
            next: (updatedComment) => {
                // Update comment in the list
                const currentTask = this.taskDetails();
                if (currentTask && currentTask.comments) {
                    const updatedComments = currentTask.comments.map(c =>
                        c.id === commentId ? updatedComment : c
                    );
                    this.taskDetails.set({ ...currentTask, comments: updatedComments });
                }
                this.editingCommentId.set(null);
                this.editCommentContent.set('');
            },
            error: (err) => {
                console.error('Error updating comment:', err);
                this.error.set('Failed to update comment');
            }
        });
    }

    cancelCommentEdit(): void {
        this.editingCommentId.set(null);
        this.editCommentContent.set('');
    }

    confirmDeleteComment(commentId: number): void {
        this.deletingCommentId.set(commentId);
    }

    deleteComment(commentId: number): void {
        this.projectService.deleteComment(commentId).subscribe({
            next: () => {
                // Remove comment from the list
                const currentTask = this.taskDetails();
                if (currentTask && currentTask.comments) {
                    const updatedComments = currentTask.comments.filter(c => c.id !== commentId);
                    this.taskDetails.set({ ...currentTask, comments: updatedComments });
                }
                this.deletingCommentId.set(null);
            },
            error: (err) => {
                console.error('Error deleting comment:', err);
                this.error.set('Failed to delete comment');
                this.deletingCommentId.set(null);
            }
        });
    }

    cancelDelete(): void {
        this.deletingCommentId.set(null);
    }

    isOwnComment(comment: any): boolean {
        return comment.userId === this.currentUserId();
    }

    // Subtask helper methods
    getSubtaskPriorityColor(priority: string): string {
        const colorMap: { [key: string]: string } = {
            'High': 'bg-red-500',
            'Medium': 'bg-yellow-500',
            'Low': 'bg-gray-400'
        };
        return colorMap[priority] || 'bg-gray-400';
    }

    getSubtaskStatusClass(status: string): string {
        const statusMap: { [key: string]: string } = {
            'OPEN': 'bg-gray-100 text-gray-800',
            'ONGOING': 'bg-blue-100 text-blue-800',
            'ON_HOLD': 'bg-purple-100 text-purple-800',
            'COMPLETED': 'bg-green-100 text-green-800'
        };
        return statusMap[status] || 'bg-gray-100 text-gray-800';
    }

    getSubtaskStatusLabel(status: string): string {
        const labelMap: { [key: string]: string } = {
            'OPEN': 'Open',
            'ONGOING': 'Ongoing',
            'ON_HOLD': 'On Hold',
            'COMPLETED': 'Completed'
        };
        return labelMap[status] || status;
    }

    getAssignedMemberForSubtask(memberId: number | undefined): ProjectMember | null {
        if (!memberId) return null;
        const members = this.projectMembers();
        return members.find(m => m.memberId === memberId) || null;
    }

    switchTab(tab: 'history' | 'comments'): void {
        this.activeTab.set(tab);
    }

    // Subtask modal handlers
    onSubtaskClick(subtaskId: number): void {
        this.selectedSubtaskId.set(subtaskId);
        this.showSubtaskModal.set(true);
    }

    closeSubtaskModal(): void {
        this.showSubtaskModal.set(false);
        this.selectedSubtaskId.set(null);
    }

    onSubtaskUpdated(): void {
        // Refresh task details to get updated subtask information
        this.loadTaskDetails();
    }

    // Subtask form modal handlers
    openSubtaskFormModal(): void {
        this.showSubtaskFormModal.set(true);
    }

    closeSubtaskFormModal(): void {
        this.showSubtaskFormModal.set(false);
    }

    onSubtaskCreated(): void {
        // Refresh task details to show the new subtask
        this.loadTaskDetails();
    }
}
