import { Component, input, output, signal, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService } from '../../services/project.service';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-project-details-modal',
    imports: [CommonModule, FormsModule],
    templateUrl: './project-details-modal.html',
    styleUrl: './project-details-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectDetailsModalComponent {
    private projectService = inject(ProjectService);

    // Input/Output signals
    isOpen = input<boolean>(false);
    projectId = input<number>(0);
    close = output<void>();
    projectUpdated = output<void>();
    projectDeleted = output<void>();

    // State signals
    projectDetails = signal<Project | null>(null);
    loading = signal<boolean>(false);
    error = signal<string | null>(null);
    saving = signal<boolean>(false);

    // Edit mode signals for each field
    editingProjectName = signal<boolean>(false);
    editingDescription = signal<boolean>(false);
    editingStartDate = signal<boolean>(false);
    editingEndDate = signal<boolean>(false);

    // Temporary edit values
    tempProjectName = signal<string>('');
    tempDescription = signal<string>('');
    tempStartDate = signal<string>('');
    tempEndDate = signal<string>('');

    constructor() {
        effect(() => {
            if (this.isOpen() && this.projectId()) {
                this.loadProjectDetails();
            }
        });
    }

    private loadProjectDetails() {
        this.loading.set(true);
        this.error.set(null);

        this.projectService.getProjectById(this.projectId()).subscribe({
            next: (project) => {
                this.projectDetails.set(project);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set('Failed to load project details');
                this.loading.set(false);
                console.error(err);
            }
        });
    }

    startEditing(field: 'projectName' | 'description' | 'startDate' | 'endDate') {
        const project = this.projectDetails();
        if (!project) return;

        switch (field) {
            case 'projectName':
                this.tempProjectName.set(project.projectName);
                this.editingProjectName.set(true);
                break;
            case 'description':
                this.tempDescription.set(project.description);
                this.editingDescription.set(true);
                break;
            case 'startDate':
                this.tempStartDate.set(project.startDate);
                this.editingStartDate.set(true);
                break;
            case 'endDate':
                this.tempEndDate.set(project.endDate);
                this.editingEndDate.set(true);
                break;
        }
    }

    cancelEditing(field: 'projectName' | 'description' | 'startDate' | 'endDate') {
        switch (field) {
            case 'projectName':
                this.editingProjectName.set(false);
                break;
            case 'description':
                this.editingDescription.set(false);
                break;
            case 'startDate':
                this.editingStartDate.set(false);
                break;
            case 'endDate':
                this.editingEndDate.set(false);
                break;
        }
    }

    saveField(field: 'projectName' | 'description' | 'startDate' | 'endDate') {
        const project = this.projectDetails();
        if (!project) return;

        let value: string;
        switch (field) {
            case 'projectName':
                value = this.tempProjectName();
                break;
            case 'description':
                value = this.tempDescription();
                break;
            case 'startDate':
                value = this.tempStartDate();
                break;
            case 'endDate':
                value = this.tempEndDate();
                break;
        }

        this.updateProject({ [field]: value });
        this.cancelEditing(field);
    }

    updateStatus(status: string) {
        this.updateProject({ status });
    }

    updatePriority(priority: string) {
        this.updateProject({ priority });
    }

    updateProject(updates: Partial<Project>) {
        const projectId = this.projectId();
        if (!projectId) return;

        this.saving.set(true);

        this.projectService.updateProject(projectId, updates).subscribe({
            next: (updatedProject) => {
                this.projectDetails.set({ ...this.projectDetails()!, ...updatedProject });
                this.saving.set(false);
                this.projectUpdated.emit();
            },
            error: (err) => {
                this.error.set('Failed to update project');
                this.saving.set(false);
                console.error(err);
            }
        });
    }

    confirmDelete() {
        if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
            this.deleteProject();
        }
    }

    private deleteProject() {
        const projectId = this.projectId();
        if (!projectId) return;

        this.saving.set(true);

        this.projectService.deleteProject(projectId).subscribe({
            next: () => {
                this.saving.set(false);
                this.projectDeleted.emit();
                this.onClose();
            },
            error: (err) => {
                this.error.set('Failed to delete project');
                this.saving.set(false);
                console.error(err);
            }
        });
    }

    formatDateTime(dateTime: string | undefined): string {
        if (!dateTime) return '—';

        try {
            // Format: yyyy-mm-ddThh:mm:ss
            const date = new Date(dateTime);
            if (isNaN(date.getTime())) return '—';

            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return '—';
        }
    }

    formatDateForInput(dateString: string | undefined): string {
        if (!dateString) return '';

        try {
            // Convert dd-mm-yyyy to yyyy-mm-dd for date input
            const parts = dateString.split('-');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                return `${year}-${month}-${day}`;
            }
            return dateString;
        } catch {
            return '';
        }
    }

    onClose() {
        this.editingProjectName.set(false);
        this.editingDescription.set(false);
        this.editingStartDate.set(false);
        this.editingEndDate.set(false);
        this.close.emit();
    }
}
