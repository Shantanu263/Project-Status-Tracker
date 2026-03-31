import {
    ChangeDetectionStrategy, ChangeDetectorRef, Component, computed,
    effect, inject, input, output, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DelayTrackerService } from '../../../services/delay-tracker.service';
import { DataSyncService } from '../../../services/data-sync.service';
import {
    CreateDelayLogPayload,
    DelayEntityType,
    DelayLog,
    DelayStatus,
    UpdateDelayLogPayload
} from '../../../models/delay-tracker.model';
import { ProjectMember } from '../../../models/project.model';

export interface ProjectItem {
    id: number;          // phaseId if type=PHASE, taskId if type=TASK
    phaseId: number;     // always the parent phase id
    name: string;
    type: 'PHASE' | 'TASK';
    endDate: string;     // yyyy-MM-dd
    assigneeMemberId: number | null;
    assigneeName: string;
    status: string;
    phaseName?: string;  // only for tasks
}

@Component({
    selector: 'app-delay-entry-modal',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './delay-entry-modal.html',
    styleUrl: './delay-entry-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DelayEntryModalComponent {
    private readonly fb = inject(FormBuilder);
    private readonly delayTrackerService = inject(DelayTrackerService);
    private readonly dataSyncService = inject(DataSyncService);
    private readonly cdr = inject(ChangeDetectorRef);

    isOpen = input<boolean>(false);
    projectId = input.required<number>();
    entry = input<DelayLog | null>(null);
    projectItems = input<ProjectItem[]>([]);
    projectMembers = input<ProjectMember[]>([]);

    close = output<void>();
    saved = output<void>();
    updated = output<void>();

    isSubmitting = signal(false);
    calculatedDelay = signal<string>('');
    showItemPicker = signal(false);
    itemSearchQuery = signal('');
    selectedItem = signal<ProjectItem | null>(null);
    showMemberDropdown = signal(false);

    // Resolved selected member object for display
    selectedMemberId = signal<number | null>(null);

    selectedMemberForEntry = computed(() => {
        const id = this.selectedMemberId();
        if (!id) return null;
        return this.projectMembers().find(m => Number(m.memberId) === id) ?? null;
    });

    entryForm!: FormGroup;

    filteredProjectItems = computed(() => {
        const query = this.itemSearchQuery().toLowerCase();
        const items = this.projectItems();
        if (!query) return items;
        return items.filter(item =>
            item.name.toLowerCase().includes(query) ||
            item.type.toLowerCase().includes(query) ||
            item.assigneeName.toLowerCase().includes(query) ||
            (item.phaseName && item.phaseName.toLowerCase().includes(query))
        );
    });

    constructor() {
        this.initForm();

        effect(() => {
            const existing = this.entry();
            const items = this.projectItems();
            if (existing) {
                this.entryForm.patchValue({
                    entityType: existing.entityType,
                    originalEndDate: this.serverDateToInputDate(existing.originalEndDate),
                    revisedEndDate: this.serverDateToInputDate(existing.revisedEndDate),
                    reason: existing.reason,
                    status: existing.status,
                    assigneeId: existing.assigneeId ?? ''
                });
                this.selectedMemberId.set(existing.assigneeId ?? null);
                this.selectedItem.set(null);
                this.updateDelayCalculation();
            } else {
                this.entryForm.reset({
                    entityType: 'TASK',
                    status: 'ONGOING',
                    assigneeId: ''
                });
                this.selectedMemberId.set(null);
                this.calculatedDelay.set('');
                this.selectedItem.set(null);
                this.showItemPicker.set(false);
                this.itemSearchQuery.set('');

                if (items && items.length === 1) {
                    setTimeout(() => {
                        this.selectProjectItem(items[0]);
                    }, 0);
                }
            }
        }, { allowSignalWrites: true });
    }

    private initForm(): void {
        this.entryForm = this.fb.group({
            entityType: ['TASK', Validators.required],
            originalEndDate: ['', Validators.required],
            revisedEndDate: ['', Validators.required],
            reason: ['', Validators.required],
            status: ['ONGOING', Validators.required],
            assigneeId: ['']
        });

        this.entryForm.get('originalEndDate')?.valueChanges.subscribe(() => this.updateDelayCalculation());
        this.entryForm.get('revisedEndDate')?.valueChanges.subscribe(() => this.updateDelayCalculation());
    }

    // ---- Item Picker --------------------------------------------------------

    toggleItemPicker(): void {
        this.showItemPicker.update(v => !v);
        if (this.showItemPicker()) {
            this.itemSearchQuery.set('');
        }
    }

    onItemSearch(event: Event): void {
        this.itemSearchQuery.set((event.target as HTMLInputElement).value);
    }

    selectProjectItem(item: ProjectItem): void {
        this.selectedItem.set(item);
        this.entryForm.patchValue({
            entityType: item.type,
            originalEndDate: item.endDate,
            status: item.status,
            assigneeId: item.assigneeMemberId ?? ''
        });
        this.selectedMemberId.set(item.assigneeMemberId ?? null);
        this.showItemPicker.set(false);
        this.itemSearchQuery.set('');
        this.updateDelayCalculation();
    }

    clearSelection(): void {
        this.selectedItem.set(null);
        this.entryForm.reset({ entityType: 'TASK', status: 'ONGOING', assigneeId: '' });
        this.selectedMemberId.set(null);
        this.calculatedDelay.set('');
    }

    // ---- Member Selector -------------------------------------------------------

    toggleMemberDropdown(): void {
        this.showMemberDropdown.update(v => !v);
    }

    selectMemberForEntry(member: ProjectMember): void {
        this.selectedMemberId.set(Number(member.memberId));
        this.entryForm.patchValue({ assigneeId: member.memberId });
        this.showMemberDropdown.set(false);
    }

    clearMemberSelection(): void {
        this.selectedMemberId.set(null);
        this.entryForm.patchValue({ assigneeId: '' });
        this.showMemberDropdown.set(false);
    }

    getMemberInitials(member: ProjectMember): string {
        if (!member?.user) return '';
        return member.user
            .split(' ')
            .map((w: string) => w[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    getMemberAvatarColor(member: ProjectMember): string {
        const name = member?.user ?? '';
        const colors = [
            'bg-blue-500', 'bg-green-500', 'bg-purple-500',
            'bg-red-500', 'bg-yellow-500', 'bg-pink-500',
            'bg-indigo-500', 'bg-teal-500'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    // ---- Submit -------------------------------------------------------------

    onSubmit(): void {
        if (this.entryForm.invalid || this.isSubmitting()) return;

        this.isSubmitting.set(true);
        const val = this.entryForm.value;
        const existing = this.entry();
        const selected = this.selectedItem();

        if (existing) {
            // Build only changed fields for PUT
            const payload: UpdateDelayLogPayload = {};
            const orig = existing;

            if (val.entityType !== orig.entityType) payload.entityType = val.entityType as DelayEntityType;
            if (val.originalEndDate && this.serverDateToInputDate(orig.originalEndDate) !== val.originalEndDate)
                payload.originalEndDate = val.originalEndDate;
            if (val.revisedEndDate && this.serverDateToInputDate(orig.revisedEndDate) !== val.revisedEndDate)
                payload.revisedEndDate = val.revisedEndDate;
            if (val.reason !== orig.reason) payload.reason = val.reason;
            if (val.status !== orig.status) payload.status = val.status as DelayStatus;
            const newAssigneeId = val.assigneeId ? Number(val.assigneeId) : null;
            if (newAssigneeId !== orig.assigneeId) payload.assigneeId = newAssigneeId ?? undefined;

            if (Object.keys(payload).length === 0) {
                this.isSubmitting.set(false);
                this.saved.emit();
                return;
            }

            this.delayTrackerService.updateDelayLog(this.projectId(), existing.delayLogId, payload).subscribe({
                next: () => { 
                    this.dataSyncService.notifyDelayTrackerUpdated(this.projectId());
                    this.isSubmitting.set(false); 
                    this.updated.emit(); 
                },
                error: (err) => { console.error('Failed to update delay log:', err); this.isSubmitting.set(false); }
            });
        } else {
            // Build POST payload
            const payload: CreateDelayLogPayload = {
                projectId: this.projectId(),
                entityType: val.entityType as DelayEntityType,
                originalEndDate: val.originalEndDate,
                revisedEndDate: val.revisedEndDate,
                status: val.status as DelayStatus,
                reason: val.reason
            };

            if (selected) {
                if (selected.type === 'PHASE') {
                    payload.phaseId = selected.phaseId;
                } else {
                    payload.phaseId = selected.phaseId;
                    payload.taskId = selected.id;
                }
            }

            // Assignee: prefer form value (user may override), fallback to selected item
            const formAssigneeId = val.assigneeId ? Number(val.assigneeId) : null;
            if (formAssigneeId) {
                payload.assigneeId = formAssigneeId;
            } else if (selected?.assigneeMemberId) {
                payload.assigneeId = selected.assigneeMemberId;
            }

            this.delayTrackerService.createDelayLog(this.projectId(), payload).subscribe({
                next: () => { 
                    this.dataSyncService.notifyDelayTrackerUpdated(this.projectId());
                    this.isSubmitting.set(false); 
                    this.saved.emit(); 
                },
                error: (err) => { console.error('Failed to create delay log:', err); this.isSubmitting.set(false); }
            });
        }
    }

    onClose(): void {
        this.close.emit();
    }

    onBackdropClick(event: Event): void {
        if (event.target === event.currentTarget) {
            this.onClose();
        }
    }

    // ---- Helpers ------------------------------------------------------------

    isFieldInvalid(fieldName: string): boolean {
        const control = this.entryForm.get(fieldName);
        return !!(control && control.invalid && control.touched);
    }

    getErrorMessage(fieldName: string): string {
        const control = this.entryForm.get(fieldName);
        if (control?.hasError('required')) return 'This field is required';
        return '';
    }

    getItemTypeClass(type: string): string {
        return type === 'PHASE'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-indigo-100 text-indigo-700';
    }

    getItemStatusClass(status: string): string {
        const statusMap: Record<string, string> = {
            'OPEN': 'bg-gray-100 text-gray-700',
            'ONGOING': 'bg-blue-100 text-blue-700',
            'COMPLETED': 'bg-green-100 text-green-700',
            'ON_HOLD': 'bg-orange-100 text-orange-700',
            'CANCELLED': 'bg-red-100 text-red-700'
        };
        return statusMap[status] || 'bg-gray-100 text-gray-700';
    }

    getStatusLabel(status: string): string {
        const map: Record<string, string> = {
            'OPEN': 'Open',
            'ONGOING': 'Ongoing',
            'COMPLETED': 'Completed',
            'ON_HOLD': 'On Hold',
            'CANCELLED': 'Cancelled'
        };
        return map[status] || status;
    }

    private updateDelayCalculation(): void {
        const original = this.entryForm.get('originalEndDate')?.value;
        const revised = this.entryForm.get('revisedEndDate')?.value;

        if (original && revised) {
            const days = this.delayTrackerService.calculateDelayDuration(original, revised);
            if (days <= 0) {
                this.calculatedDelay.set('No delay');
            } else if (days === 1) {
                this.calculatedDelay.set('1 day');
            } else if (days < 7) {
                this.calculatedDelay.set(`${days} days`);
            } else {
                const weeks = Math.floor(days / 7);
                const remainingDays = days % 7;
                if (remainingDays === 0) {
                    this.calculatedDelay.set(weeks === 1 ? '1 week' : `${weeks} weeks`);
                } else {
                    this.calculatedDelay.set(`${weeks}w ${remainingDays}d`);
                }
            }
        } else {
            this.calculatedDelay.set('');
        }
    }

    /** Convert server format dd-MM-yyyy → yyyy-MM-dd for HTML date input */
    private serverDateToInputDate(date: string): string {
        if (!date) return '';
        const parts = date.split('-');
        if (parts.length !== 3) return '';
        // dd-MM-yyyy
        if (parts[0].length === 2) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return date; // already yyyy-MM-dd
    }
}
