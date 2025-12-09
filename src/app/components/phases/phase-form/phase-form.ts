import { Component, input, output, ChangeDetectionStrategy, OnInit, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Phase } from '../../../models/phase.model';

@Component({
    selector: 'app-phase-form',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './phase-form.html',
    styleUrl: './phase-form.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PhaseFormComponent implements OnInit {
    private fb = inject(FormBuilder);

    phase = input<Phase | null>(null);

    submit = output<Phase>();
    cancel = output<void>();

    phaseForm!: FormGroup;
    private isSubmitting = false;

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
            status: [existingPhase?.status || 'pending']
        });

        // Mark form as pristine to avoid triggering change detection issues
        this.phaseForm.markAsPristine();
        this.phaseForm.markAsUntouched();
        this.isSubmitting = false;
    }

    ngOnInit(): void {
        // ngOnInit is kept for Angular lifecycle, but initialization is done in effect
    }

    onSubmit(): void {
        if (this.isSubmitting) {
            return;
        }

        if (this.phaseForm.valid) {
            const formValue = this.phaseForm.value;
            const phase: Phase = {
                phaseName: formValue.phaseName,
                description: formValue.description || '',
                startDate: formValue.startDate || '',
                endDate: formValue.endDate || '',
                status: formValue.status || 'pending',
                projectMemberId: 1
            };
            this.isSubmitting = true;
            this.submit.emit(phase);
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
}
