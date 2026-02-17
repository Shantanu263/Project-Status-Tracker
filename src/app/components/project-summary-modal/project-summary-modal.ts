import { Component, input, output, signal, inject, computed, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgxEditorModule, Editor, Toolbar } from 'ngx-editor';
import { ProjectSummaryService, ProjectSummaryPayload, EmailSummaryPayload } from '../../services/project-summary.service';

type SummaryAction = 'download' | 'email';

@Component({
    selector: 'app-project-summary-modal',
    imports: [CommonModule, ReactiveFormsModule, NgxEditorModule],
    templateUrl: './project-summary-modal.html',
    styleUrl: './project-summary-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectSummaryModalComponent {
    private fb = inject(FormBuilder);
    private summaryService = inject(ProjectSummaryService);

    // Inputs/Outputs
    isOpen = input.required<boolean>();
    projectId = input.required<number>();
    action = input.required<SummaryAction>();
    close = output<void>();
    summaryGenerated = output<void>();

    // State
    isLoading = signal(false);
    errorMessage = signal<string | null>(null);

    // Editor instances
    currentStatusEditor!: Editor;
    nextStepsEditor!: Editor;

    // Toolbar configuration
    toolbar: Toolbar = [
        ['bold', 'italic'],
        ['ordered_list', 'bullet_list']
    ];

    // Form
    summaryForm: FormGroup;

    // Computed modal title
    modalTitle = computed(() => {
        return this.action() === 'download'
            ? 'Download Project Summary'
            : 'Email Project Summary';
    });

    // Computed submit button text
    submitButtonText = computed(() => {
        return this.action() === 'download'
            ? 'Download PDF'
            : 'Send Email';
    });

    // Computed if email field should be shown
    showEmailField = computed(() => this.action() === 'email');

    constructor() {
        this.summaryForm = this.fb.group({
            currentStatus: ['', Validators.required],
            nextSteps: ['', Validators.required],
            email: [''],
            includeRecentlyCompletedTasks: [false],
            includeUpcomingTasks: [false]
        });

        // Initialize editors on modal open
        effect(() => {
            if (this.isOpen()) {
                this.initializeEditors();
                this.updateEmailValidation();
            } else {
                this.destroyEditors();
            }
        });

        // Update email validation when action changes
        effect(() => {
            this.updateEmailValidation();
        });
    }

    private initializeEditors(): void {
        // Always destroy existing editors first
        this.destroyEditors();

        // Create fresh editor instances
        this.currentStatusEditor = new Editor();
        this.nextStepsEditor = new Editor();
    }

    private destroyEditors(): void {
        if (this.currentStatusEditor) {
            this.currentStatusEditor.destroy();
            // @ts-ignore - Reset to undefined for proper cleanup
            this.currentStatusEditor = undefined;
        }
        if (this.nextStepsEditor) {
            this.nextStepsEditor.destroy();
            // @ts-ignore - Reset to undefined for proper cleanup
            this.nextStepsEditor = undefined;
        }
    }

    private updateEmailValidation(): void {
        const emailControl = this.summaryForm.get('email');
        if (this.action() === 'email') {
            emailControl?.setValidators([Validators.required, Validators.email]);
        } else {
            emailControl?.clearValidators();
        }
        emailControl?.updateValueAndValidity();
    }

    async onSubmit(): Promise<void> {
        if (this.summaryForm.invalid) {
            this.errorMessage.set('Please fill in all required fields');
            return;
        }

        this.isLoading.set(true);
        this.errorMessage.set(null);

        const currentStatusHtml = this.summaryForm.get('currentStatus')?.value || '';
        const nextStepsHtml = this.summaryForm.get('nextSteps')?.value || '';
        const includeRecentlyCompletedTasks = this.summaryForm.get('includeRecentlyCompletedTasks')?.value;
        const includeUpcomingTasks = this.summaryForm.get('includeUpcomingTasks')?.value;

        try {
            if (this.action() === 'download') {
                await this.downloadSummary({
                    currentStatusHtml,
                    nextStepsHtml,
                    recentlyCompletedTasks: includeRecentlyCompletedTasks || undefined,
                    upcomingTasks: includeUpcomingTasks || undefined
                });
            } else {
                const email = this.summaryForm.get('email')?.value;
                await this.emailSummary({
                    email,
                    currentStatusHtml,
                    nextStepsHtml,
                    recentlyCompletedTasks: includeRecentlyCompletedTasks || undefined,
                    upcomingTasks: includeUpcomingTasks || undefined
                });
            }

            this.isLoading.set(false);
            this.summaryGenerated.emit();
            this.onClose();
        } catch (error) {
            this.isLoading.set(false);
            this.errorMessage.set(
                this.action() === 'download'
                    ? 'Failed to generate PDF. Please try again.'
                    : 'Failed to send email. Please try again.'
            );
            console.error('Error generating summary:', error);
        }
    }

    private async downloadSummary(payload: ProjectSummaryPayload): Promise<void> {
        const blob = await this.summaryService
            .downloadProjectSummary(this.projectId(), payload)
            .toPromise();

        if (blob) {
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `project-summary-${this.projectId()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        }
    }

    private async emailSummary(payload: EmailSummaryPayload): Promise<void> {
        await this.summaryService
            .emailProjectSummary(this.projectId(), payload)
            .toPromise();
    }

    onClose(): void {
        this.summaryForm.reset();
        this.errorMessage.set(null);
        this.close.emit();
    }

    ngOnDestroy(): void {
        this.destroyEditors();
    }
}
