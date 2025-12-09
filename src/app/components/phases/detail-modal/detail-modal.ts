import { Component, input, output, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy } from '@angular/core';
import { Phase, Task } from '../../../models/phase.model';
import { ProjectMember } from '../../../models/project.model';

@Component({
    selector: 'app-detail-modal',
    imports: [CommonModule, FormsModule],
    templateUrl: './detail-modal.html',
    styleUrl: './detail-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(document:click)': 'onDocumentClick($event)'
    }
})
export class DetailModalComponent {
    isOpen = input.required<boolean>();
    mode = input.required<'phase' | 'task'>();
    item = input<Phase | Task | null>(null);
    projectMembers = input<ProjectMember[]>([]);

    close = output<void>();
    save = output<any>();

    // Form state
    formData = signal<any>({});
    originalData = signal<any>({});
    isSaving = signal(false);
    showMemberDropdown = signal(false);
    selectedMember = signal<ProjectMember | null>(null);
    showStatusDropdown = signal(false);
    showPriorityDropdown = signal(false);

    statusOptions: Array<{ value: string; label: string }> = [
        { value: 'TO_DO', label: 'To Do' },
        { value: 'IN_PROGRESS', label: 'In Progress' },
        { value: 'DONE', label: 'Done' },
        { value: 'REVIEW', label: 'Review' }
    ];

    priorityOptions: Array<{ value: string; label: string }> = [
        { value: 'Low', label: 'Low' },
        { value: 'Medium', label: 'Medium' },
        { value: 'High', label: 'High' }
    ];

    constructor() {
        effect(() => {
            const currentItem = this.item();
            if (currentItem) {
                const data = { ...currentItem };
                this.formData.set(data);
                this.originalData.set({ ...currentItem });

                // Set selected member for tasks
                if (this.mode() === 'task' && 'assignedTo' in currentItem && currentItem.assignedTo) {
                    const member = this.projectMembers().find(m => m.memberId === currentItem.assignedTo);
                    this.selectedMember.set(member || null);
                }
            }
        });
    }

    get title(): string {
        const itemMode = this.mode();
        return itemMode === 'phase' ? 'Phase Details' : 'Task Details';
    }

    get isPhase(): boolean {
        return this.mode() === 'phase';
    }

    get isTask(): boolean {
        return this.mode() === 'task';
    }

    onClose(): void {
        this.close.emit();
    }

    onSave(): void {
        const original = this.originalData();
        const current = this.formData();
        const updates: any = {};

        // Only include fields that were modified
        if (this.isPhase) {
            const phaseFields = ['phaseName', 'description', 'startDate', 'endDate', 'status'];
            phaseFields.forEach(field => {
                if (current[field] !== original[field]) {
                    updates[field] = current[field];
                }
            });
        } else {
            const taskFields = ['taskName', 'description', 'startDate', 'endDate', 'status', 'priority', 'assignedTo'];
            taskFields.forEach(field => {
                if (current[field] !== original[field]) {
                    updates[field] = current[field];
                }
            });
        }

        if (Object.keys(updates).length > 0) {
            this.isSaving.set(true);
            this.save.emit(updates);
        } else {
            this.onClose();
        }
    }

    updateField(field: string, value: any): void {
        const current = this.formData();
        this.formData.set({ ...current, [field]: value });
    }

    getStatusLabel(status?: string): string {
        if (!status) return 'Not Set';
        const option = this.statusOptions.find(opt => opt.value === status);
        return option ? option.label : status;
    }

    getStatusBadgeColor(status?: string): string {
        switch (status) {
            case 'DONE':
                return 'bg-green-100 text-green-700';
            case 'IN_PROGRESS':
                return 'bg-blue-100 text-blue-700';
            case 'REVIEW':
                return 'bg-yellow-100 text-yellow-700';
            case 'TO_DO':
                return 'bg-gray-100 text-gray-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    }

    getPriorityBadgeColor(priority?: string): string {
        switch (priority) {
            case 'High':
                return 'bg-red-100 text-red-700';
            case 'Medium':
                return 'bg-orange-100 text-orange-700';
            case 'Low':
                return 'bg-blue-100 text-blue-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    }

    getMemberName(memberId?: number): string {
        if (!memberId) return 'Unassigned';
        const member = this.projectMembers().find(m => m.memberId === memberId);
        return member ? member.user : 'Unknown';
    }

    // Member selector methods (from task-form)
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
        this.updateField('assignedTo', member.memberId);
        this.showMemberDropdown.set(false);
    }

    clearSelection(): void {
        this.selectedMember.set(null);
        this.updateField('assignedTo', null);
        this.showMemberDropdown.set(false);
    }

    getSelectedMember(): ProjectMember | null {
        return this.selectedMember();
    }

    toggleStatusDropdown(): void {
        this.showStatusDropdown.update(value => !value);
        this.showPriorityDropdown.set(false);
    }

    selectStatus(status: string): void {
        this.updateField('status', status);
        this.showStatusDropdown.set(false);
    }

    togglePriorityDropdown(): void {
        this.showPriorityDropdown.update(value => !value);
        this.showStatusDropdown.set(false);
    }

    selectPriority(priority: string): void {
        this.updateField('priority', priority);
        this.showPriorityDropdown.set(false);
    }

    onDocumentClick(event: Event): void {
        const target = event.target as HTMLElement;
        const selector = target.closest('.member-selector, .status-selector, .priority-selector');
        if (!selector) {
            this.showMemberDropdown.set(false);
            this.showStatusDropdown.set(false);
            this.showPriorityDropdown.set(false);
        }
    }
}
