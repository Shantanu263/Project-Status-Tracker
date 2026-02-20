import { Component, input, output, ChangeDetectionStrategy, OnInit, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Task } from '../../../models/phase.model';
import { ProjectService } from '../../../services/project.service';
import { ProjectMember } from '../../../models/project.model';

@Component({
    selector: 'app-task-form',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './task-form.html',
    styleUrl: './task-form.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
})
export class TaskFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private projectService = inject(ProjectService);
    private snackBar = inject(MatSnackBar);

    isOpen = input<boolean>(false);
    task = input<Task | null>(null);
    projectId = input.required<number>();
    phases = input<any[]>([]);

    taskSubmit = output<Task>();
    cancel = output<void>();
    close = output<void>();

    taskForm!: FormGroup;
    projectMembers = signal<ProjectMember[]>([]);
    selectedMember = signal<ProjectMember | null>(null);
    showMemberDropdown = signal(false);
    isSubmittingSignal = signal(false);
    showPriorityDropdown = signal(false);
    showStatusDropdown = signal(false);
    private initialized = false;
    private lastInitializedTaskId: number | undefined = undefined;

    // Computed property to filter only active members (exclude PROJECT_VIEWER)
    activeMembers = computed(() =>
        this.projectMembers().filter(member =>
            member.isActive && member.role !== 'PROJECT_VIEWER'
        )
    );

    // Computed to ensure phases is always an array
    availablePhases = computed(() => this.phases() || []);

    constructor() {
        // Initialize form immediately to prevent undefined errors
        this.taskForm = this.fb.group({
            taskName: ['', [Validators.required, Validators.minLength(3)]],
            description: [''],
            projectPhaseId: [''],
            startDate: [''],
            endDate: [''],
            status: ['OPEN'],
            priority: ['Medium'],
            assignedTo: ['']
        });
    }

    ngOnInit(): void {
        // Initialize form with task data when component loads
        const task = this.task();
        const projectId = this.projectId();

        if (task) {
            this.lastInitializedTaskId = task.taskId;
            this.taskForm.patchValue({
                taskName: task.taskName || '',
                description: task.description || '',
                projectPhaseId: task.projectPhaseId || '',
                startDate: task.startDate || '',
                endDate: task.endDate || '',
                status: task.status || 'OPEN',
                priority: task.priority || 'Medium',
                assignedTo: task.assignedTo || ''
            }, { emitEvent: false });
        }

        // Load project members
        if (projectId && !this.initialized) {
            this.initialized = true;
            this.projectService.getProjectMembers(projectId).subscribe({
                next: (members) => {
                    this.projectMembers.set(members || []);
                },
                error: (err) => {
                    console.error('Error loading project members:', err);
                }
            });
        }
    }

    onSubmit(): void {
        if (this.isSubmittingSignal()) {
            return;
        }

        if (this.taskForm.valid) {
            const formValue = this.taskForm.value;
            const task: Task = {
                taskName: formValue.taskName,
                description: formValue.description || '',
                projectPhaseId: formValue.projectPhaseId ? Number(formValue.projectPhaseId) : undefined,
                startDate: formValue.startDate || '',
                endDate: formValue.endDate || '',
                status: formValue.status || 'OPEN',
                priority: formValue.priority || 'Medium',
                assignedTo: formValue.assignedTo ? Number(formValue.assignedTo) : undefined
            };
            // Only emit if the task has required fields
            if (task.taskName && task.taskName.trim()) {
                this.isSubmittingSignal.set(true);
                this.taskSubmit.emit(task);

                // Show success notification
                this.snackBar.open('Task created successfully!', 'Close', {
                    duration: 3000,
                    horizontalPosition: 'center',
                    verticalPosition: 'bottom'
                });
            }
        } else {
            this.taskForm.markAllAsTouched();
        }
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
        const name = member.user || '';
        const colors = ['bg-blue-500', 'bg-green-500', 'bg-red-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500'];
        const charCode = name.charCodeAt(0);
        return colors[charCode % colors.length];
    }

    toggleMemberDropdown(): void {
        this.showMemberDropdown.update(value => !value);
    }

    selectMember(member: ProjectMember): void {
        this.selectedMember.set(member);
        this.taskForm.patchValue({
            assignedTo: member.memberId
        });
        this.showMemberDropdown.set(false);
    }

    clearSelection(): void {
        this.selectedMember.set(null);
        this.taskForm.patchValue({
            assignedTo: ''
        });
        this.showMemberDropdown.set(false);
    }

    getSelectedMember(): ProjectMember | null {
        return this.selectedMember();
    }

    onDocumentClick(event: Event): void {
        const target = event.target as HTMLElement;
        const selector = target.closest('.member-selector');
        const prioritySelector = target.closest('.priority-selector');
        const statusSelector = target.closest('.status-selector');

        if (!selector) {
            this.showMemberDropdown.set(false);
        }
        if (!prioritySelector) {
            this.showPriorityDropdown.set(false);
        }
        if (!statusSelector) {
            this.showStatusDropdown.set(false);
        }
    }

    togglePriorityDropdown(): void {
        this.showPriorityDropdown.update(value => !value);
        this.showStatusDropdown.set(false);
    }

    toggleStatusDropdown(): void {
        this.showStatusDropdown.update(value => !value);
        this.showPriorityDropdown.set(false);
    }

    selectPriority(priority: string): void {
        this.taskForm.patchValue({ priority });
        this.showPriorityDropdown.set(false);
    }

    selectStatus(status: string): void {
        this.taskForm.patchValue({ status });
        this.showStatusDropdown.set(false);
    }

    onCancel(): void {
        this.isSubmittingSignal.set(false);
        this.cancel.emit();
    }

    onClose(): void {
        this.isSubmittingSignal.set(false);
        this.close.emit();
    }

    onBackdropClick(event: Event): void {
        if (event.target === event.currentTarget) {
            this.onClose();
        }
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.taskForm.get(fieldName);
        return !!(field && field.invalid && (field.dirty || field.touched));
    }

    getErrorMessage(fieldName: string): string {
        const field = this.taskForm.get(fieldName);
        if (field?.hasError('required')) {
            return 'This field is required';
        }
        if (field?.hasError('minlength')) {
            return 'Minimum length is 3 characters';
        }
        return '';
    }

    getPriorityColor(priority: string): string {
        const colors: Record<string, string> = {
            'Low': 'bg-green-100 text-green-700 border-green-300',
            'Medium': 'bg-yellow-100 text-yellow-700 border-yellow-300',
            'High': 'bg-red-100 text-red-700 border-red-300'
        };
        return colors[priority] || 'bg-gray-100 text-gray-700 border-gray-300';
    }

    getStatusColor(status: string): string {
        const colors: Record<string, string> = {
            'OPEN': 'bg-gray-100 text-gray-700 border-gray-300',
            'ONGOING': 'bg-blue-100 text-blue-700 border-blue-300',
            'COMPLETED': 'bg-green-100 text-green-700 border-green-300',
            'ON_HOLD': 'bg-purple-100 text-purple-700 border-purple-300'
        };
        return colors[status] || 'bg-gray-100 text-gray-700 border-gray-300';
    }

    getPriorityColorBox(priority: string): string {
        const colors: Record<string, string> = {
            'Low': 'bg-green-500',
            'Medium': 'bg-yellow-500',
            'High': 'bg-red-500'
        };
        return colors[priority] || 'bg-gray-500';
    }

    getStatusColorBox(status: string): string {
        const colors: Record<string, string> = {
            'OPEN': 'bg-gray-500',
            'ONGOING': 'bg-blue-500',
            'COMPLETED': 'bg-green-500',
            'ON_HOLD': 'bg-purple-500'
        };
        return colors[status] || 'bg-gray-500';
    }

    getPriorityLabel(priority: string): string {
        return priority || 'Medium';
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            'OPEN': 'Open',
            'ONGOING': 'Ongoing',
            'COMPLETED': 'Completed',
            'ON_HOLD': 'On Hold'
        };
        return labels[status] || status;
    }
}
