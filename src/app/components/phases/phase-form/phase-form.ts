import { Component, input, output, ChangeDetectionStrategy, OnInit, inject, effect, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Phase } from '../../../models/phase.model';
import { ProjectMember } from '../../../models/project.model';
import { ProjectService } from '../../../services/project.service';

@Component({
    selector: 'app-phase-form',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './phase-form.html',
    styleUrl: './phase-form.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
})
export class PhaseFormComponent implements OnInit {
    private fb = inject(FormBuilder);
    private projectService = inject(ProjectService);
    private snackBar = inject(MatSnackBar);

    phase = input<Phase | null>(null);
    projectId = input.required<number>();

    submit = output<Phase>();
    cancel = output<void>();

    phaseForm!: FormGroup;
    projectMembers = signal<ProjectMember[]>([]);
    selectedMember = signal<ProjectMember | null>(null);
    showMemberDropdown = signal(false);
    private isSubmitting = false;
    private initialized = false;

    // Computed property to filter only active members
    activeMembers = computed(() =>
        this.projectMembers().filter(member => member.isActive)
    );

    constructor() {
        effect(() => {
            // Re-initialize form when phase input changes
            const phase = this.phase();
            this.initializeForm(phase);
        });
    }

    private initializeForm(phase: Phase | null): void {
        const existingPhase = phase;

        this.phaseForm = this.fb.group({
            phaseName: [existingPhase?.phaseName || '', [Validators.required, Validators.minLength(3)]],
            description: [existingPhase?.description || ''],
            startDate: [existingPhase?.startDate || ''],
            endDate: [existingPhase?.endDate || ''],
            status: [existingPhase?.status || 'OPEN'],
            assignedTo: [existingPhase?.projectMemberId || '']
        });

        // Set selected member if phase has assignee
        if (existingPhase?.projectMemberId) {
            const member = this.projectMembers().find(m => m.memberId === existingPhase.projectMemberId);
            if (member) {
                this.selectedMember.set(member);
            }
        }

        // Mark form as pristine to avoid triggering change detection issues
        this.phaseForm.markAsPristine();
        this.phaseForm.markAsUntouched();
        this.isSubmitting = false;
    }

    ngOnInit(): void {
        // Load project members
        const projectId = this.projectId();
        if (projectId && !this.initialized) {
            this.initialized = true;
            this.projectService.getProjectMembers(projectId).subscribe({
                next: (members) => {
                    // Filter out PROJECT_HANDLER and PROJECT_VIEWER roles
                    const filteredMembers = members.filter(
                        m => m.role !== 'PROJECT_HANDLER' && m.role !== 'PROJECT_VIEWER'
                    );
                    this.projectMembers.set(filteredMembers || []);
                },
                error: (err) => {
                    console.error('Error loading project members:', err);
                }
            });
        }
    }

    onSubmit(): void {
        if (this.isSubmitting) {
            return;
        }

        if (this.phaseForm.valid) {
            const formValue = this.phaseForm.value;

            // Map display status to backend format
            const statusMapping: Record<string, string> = {
                'Open': 'OPEN',
                'Ongoing': 'ONGOING',
                'Completed': 'COMPLETED',
                'On Hold': 'ON_HOLD',
                'OPEN': 'OPEN',
                'ONGOING': 'ONGOING',
                'COMPLETED': 'COMPLETED',
                'ON_HOLD': 'ON_HOLD'
            };

            const phase: Phase = {
                phaseName: formValue.phaseName,
                description: formValue.description || '',
                startDate: formValue.startDate || '',
                endDate: formValue.endDate || '',
                status: statusMapping[formValue.status] || formValue.status,
                projectMemberId: formValue.assignedTo ? Number(formValue.assignedTo) : undefined
            };
            this.isSubmitting = true;
            this.submit.emit(phase);

            // Show success notification
            this.snackBar.open('Phase created successfully!', 'Close', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom'
            });

            // Reset flag after emit
            setTimeout(() => {
                this.isSubmitting = false;
            }, 100);
        } else {
            this.phaseForm.markAllAsTouched();
        }
    }

    onCancel(): void {
        this.isSubmitting = false;
        this.cancel.emit();
    }

    isFieldInvalid(fieldName: string): boolean {
        const field = this.phaseForm.get(fieldName);
        return !!(field && field.invalid && (field.dirty || field.touched));
    }

    getErrorMessage(fieldName: string): string {
        const field = this.phaseForm.get(fieldName);
        if (field?.hasError('required')) {
            return 'This field is required';
        }
        if (field?.hasError('minlength')) {
            return 'Minimum length is 3 characters';
        }
        return '';
    }

    // Member selection methods
    toggleMemberDropdown(): void {
        this.showMemberDropdown.update(value => !value);
    }

    selectMember(member: ProjectMember): void {
        this.selectedMember.set(member);
        this.phaseForm.patchValue({
            assignedTo: member.memberId
        });
        this.showMemberDropdown.set(false);
    }

    clearSelection(): void {
        this.selectedMember.set(null);
        this.phaseForm.patchValue({
            assignedTo: ''
        });
        this.showMemberDropdown.set(false);
    }

    getSelectedMember(): ProjectMember | null {
        return this.selectedMember();
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

    onDocumentClick(event: Event): void {
        const target = event.target as HTMLElement;
        const selector = target.closest('.member-selector');
        if (!selector) {
            this.showMemberDropdown.set(false);
        }
    }
}
