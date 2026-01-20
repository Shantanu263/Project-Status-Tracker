import { Component, input, output, signal, effect, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { ProjectMember } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';
import { AuthService } from '../../../services/auth.service';
import { SubTask, Comment, Log } from '../../../models/phase.model';
import { MatSnackBar } from '@angular/material/snack-bar';


@Component({
    selector: 'app-subtask-details-modal',
    imports: [CommonModule, FormsModule],
    templateUrl: './subtask-details-modal.html',
    styleUrl: './subtask-details-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubtaskDetailsModalComponent {
    private projectService = inject(ProjectService);
    private authService = inject(AuthService);
    private snackBar = inject(MatSnackBar);


    // Inputs
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    phaseId = input.required<number>();
    taskId = input.required<number>();
    subTaskId = input.required<number>();
    projectMembers = input<ProjectMember[]>([]);

    // Outputs
    close = output<void>();
    updated = output<void>();

    // State
    subtaskDetails = signal<SubTask | null>(null);
    loading = signal(false);
    error = signal<string | null>(null);
    editingField = signal<string | null>(null);
    activeTab = signal<'history' | 'comments'>('history');
    showMemberDropdown = signal(false);
    showMoreMenu = signal(false);
    showDeleteConfirmation = signal(false);

    // Comment state
    editingCommentId = signal<number | null>(null);
    deletingCommentId = signal<number | null>(null);
    newCommentContent = signal<string>('');
    editCommentContent = signal<string>('');
    currentUserId = signal<number | null>(this.authService.getCurrentUserId());

    // Computed values
    assignedMember = computed(() => {
        const subtask = this.subtaskDetails();
        const members = this.projectMembers();
        if (!subtask || !subtask.assignedToProjectMemberId) return null;
        return members.find(m => m.memberId === subtask.assignedToProjectMemberId) || null;
    });

    activeProjectMembers = computed(() => this.projectMembers().filter(member => member.isActive));

    recentLogs = computed(() => {
        const subtask = this.subtaskDetails();
        if (!subtask || !subtask.logs) return [];
        return [...subtask.logs]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5);
    });

    constructor() {
        effect(() => {
            if (this.isOpen() && this.projectId() && this.phaseId() && this.taskId() && this.subTaskId()) {
                this.loadSubtaskDetails();
            }
        }, { allowSignalWrites: true });
    }

    loadSubtaskDetails(): void {
        this.loading.set(true);
        this.error.set(null);

        this.projectService.getSubtaskDetails(this.projectId(), this.phaseId(), this.taskId(), this.subTaskId())
            .subscribe({
                next: (subtask) => {
                    this.subtaskDetails.set(subtask);
                    this.loading.set(false);
                },
                error: (err) => {
                    console.error('Error loading subtask details:', err);
                    this.error.set('Failed to load subtask details');
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
        this.projectService.deleteSubtask(this.projectId(), this.phaseId(), this.taskId(), this.subTaskId()).subscribe({
            next: () => {
                this.showDeleteConfirmation.set(false);
                this.close.emit();
                // Notify parent to refresh
                this.updated.emit();
            },
            error: (err: any) => {
                console.error('Error deleting subtask:', err);
                this.error.set('Failed to delete subtask');
                this.showDeleteConfirmation.set(false);
            }
        });
        // Show success notification
        this.snackBar.open('Subtask deleted successfully!', 'Close', {
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

    updateSubtaskName(newValue: string): void {
        if (!newValue.trim()) return;
        this.updateField('subTaskName', newValue);
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
        const updates: any = { [field]: value };

        // Immediately update the local state for instant feedback
        const currentSubtask = this.subtaskDetails();
        if (currentSubtask) {
            this.subtaskDetails.set({ ...currentSubtask, [field]: value });
        }

        // Then update the backend
        this.projectService.updateSubtask(
            this.projectId(),
            this.phaseId(),
            this.taskId(),
            this.subTaskId(),
            updates
        ).subscribe({
            next: () => {
                // Reload full subtask details to ensure all fields are up-to-date
                this.loadSubtaskDetails();
                this.updated.emit();
            },
            error: (err) => {
                console.error('Error updating subtask:', err);
                this.error.set(`Failed to update ${field}`);
                this.loadSubtaskDetails();
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
        const parts = dateString.split('-');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString;
    }

    formatDateForBackend(dateString: string | undefined): string {
        if (!dateString) return '';
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
                const currentSubtask = this.subtaskDetails();
                if (currentSubtask) {
                    const updatedComments = [...(currentSubtask.comments || []), newComment];
                    this.subtaskDetails.set({ ...currentSubtask, comments: updatedComments });
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
                const currentSubtask = this.subtaskDetails();
                if (currentSubtask && currentSubtask.comments) {
                    const updatedComments = currentSubtask.comments.map(c =>
                        c.id === commentId ? updatedComment : c
                    );
                    this.subtaskDetails.set({ ...currentSubtask, comments: updatedComments });
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
                const currentSubtask = this.subtaskDetails();
                if (currentSubtask && currentSubtask.comments) {
                    const updatedComments = currentSubtask.comments.filter(c => c.id !== commentId);
                    this.subtaskDetails.set({ ...currentSubtask, comments: updatedComments });
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

    switchTab(tab: 'history' | 'comments'): void {
        this.activeTab.set(tab);
    }
}
