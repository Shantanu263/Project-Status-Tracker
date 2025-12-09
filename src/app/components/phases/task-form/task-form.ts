import { Component, input, output, ChangeDetectionStrategy, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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

    task = input<Task | null>(null);
    projectId = input.required<number>();

    submit = output<Task>();
    cancel = output<void>();

    taskForm!: FormGroup;
    projectMembers = signal<ProjectMember[]>([]);
    selectedMember = signal<ProjectMember | null>(null);
    showMemberDropdown = signal(false);
    private isSubmitting = false;
    private initialized = false;

    constructor() {
        effect(() => {
            // Re-initialize form when projectId changes or task input changes
            const pId = this.projectId();
            const task = this.task();
            this.initializeForm(task, pId);
        });
    }

    private initializeForm(task: Task | null, projectId: number): void {
        const existingTask = task;

        this.taskForm = this.fb.group({
            taskName: [existingTask?.taskName || '', [Validators.required, Validators.minLength(3)]],
            description: [existingTask?.description || ''],
            startDate: [existingTask?.startDate || ''],
            endDate: [existingTask?.endDate || ''],
            status: [existingTask?.status || 'TO_DO'],
            priority: [existingTask?.priority || 'Medium'],
            assignedTo: [existingTask?.assignedTo || '']
        });

        // Mark form as pristine to avoid triggering change detection issues
        this.taskForm.markAsPristine();
        this.taskForm.markAsUntouched();
        this.isSubmitting = false;

        // Load project members only once
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

    ngOnInit(): void {
        // ngOnInit is kept for Angular lifecycle, but initialization is done in effect
    }

    onSubmit(): void {
        if (this.isSubmitting) {
            return;
        }

        if (this.taskForm.valid) {
            const formValue = this.taskForm.value;
            const task: Task = {
                taskName: formValue.taskName,
                description: formValue.description || '',
                startDate: formValue.startDate || '',
                endDate: formValue.endDate || '',
                status: formValue.status || 'TO_DO',
                priority: formValue.priority || 'Medium',
                assignedTo: formValue.assignedTo ? Number(formValue.assignedTo) : undefined
            };
            // Only emit if the task has required fields
            if (task.taskName && task.taskName.trim()) {
                this.isSubmitting = true;
                this.submit.emit(task);
                // Reset flag after emit
                setTimeout(() => {
                    this.isSubmitting = false;
                }, 100);
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
        if (!selector) {
            this.showMemberDropdown.set(false);
        }
    }

    onCancel(): void {
        this.isSubmitting = false;
        this.cancel.emit();
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
}
