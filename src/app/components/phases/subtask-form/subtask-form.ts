import { Component, input, output, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProjectMember } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';

interface SubTaskForm {
    subTaskName: string;
    startDate: string;
    endDate: string;
    status: 'TO_DO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
    priority: 'Low' | 'Medium' | 'High';
    assignedTo: number | null;
}

@Component({
    selector: 'app-subtask-form',
    imports: [CommonModule, FormsModule],
    templateUrl: './subtask-form.html',
    styleUrl: './subtask-form.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubtaskFormComponent implements OnInit {
    private projectService = inject(ProjectService);
    private snackBar = inject(MatSnackBar);

    // Inputs
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    phaseId = input.required<number>();
    taskId = input.required<number>();
    projectMembers = input<ProjectMember[]>([]);

    // Outputs
    close = output<void>();
    subtaskCreated = output<void>();

    // State
    subtaskForm = signal<SubTaskForm>({
        subTaskName: '',
        startDate: '',
        endDate: '',
        status: 'TO_DO',
        priority: 'Medium',
        assignedTo: null
    });
    isSubmitting = signal(false);
    error = signal<string | null>(null);
    showMemberDropdown = signal(false);

    // Computed
    activeMembers = computed(() =>
        this.projectMembers().filter(member => member.isActive)
    );

    getSelectedMember = computed(() => {
        const assignedTo = this.subtaskForm().assignedTo;
        if (!assignedTo) return null;
        return this.projectMembers().find(m => m.memberId === assignedTo) || null;
    });

    ngOnInit(): void {
        // Initialize with current date
        const today = new Date();
        const formattedToday = this.formatDateForInput(today);
        this.subtaskForm.update(form => ({
            ...form,
            startDate: formattedToday
        }));
    }

    onClose(): void {
        this.close.emit();
    }

    onSubmit(): void {
        const form = this.subtaskForm();

        // Validation
        if (!form.subTaskName.trim()) {
            this.error.set('Subtask name is required');
            return;
        }

        if (!form.startDate || !form.endDate) {
            this.error.set('Start date and end date are required');
            return;
        }

        this.isSubmitting.set(true);
        this.error.set(null);

        // Convert dates to backend format (YYYY-MM-DD)
        const payload = {
            subTaskName: form.subTaskName.trim(),
            startDate: form.startDate,
            endDate: form.endDate,
            status: form.status,
            priority: form.priority,
            assignedTo: form.assignedTo
        };

        this.projectService.createSubtask(
            this.projectId(),
            this.phaseId(),
            this.taskId(),
            payload
        ).subscribe({
            next: () => {
                this.isSubmitting.set(false);
                this.subtaskCreated.emit();

                // Show success notification
                this.snackBar.open('Subtask created successfully!', 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom'
                });

                this.onClose();
            },
            error: (err) => {
                console.error('Error creating subtask:', err);
                this.error.set('Failed to create subtask. Please try again.');
                this.isSubmitting.set(false);
            }
        });
    }

    updateField(field: keyof SubTaskForm, value: any): void {
        this.subtaskForm.update(form => ({
            ...form,
            [field]: value
        }));
    }

    formatDateForInput(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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

    toggleMemberDropdown(): void {
        this.showMemberDropdown.update(v => !v);
    }

    selectMember(member: ProjectMember): void {
        const memberId = typeof member.memberId === 'string' ? parseInt(member.memberId, 10) : member.memberId;
        this.updateField('assignedTo', memberId || null);
        this.showMemberDropdown.set(false);
    }

    clearSelection(): void {
        this.updateField('assignedTo', null);
        this.showMemberDropdown.set(false);
    }
}
