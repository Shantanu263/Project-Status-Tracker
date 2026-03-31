import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, inject, input, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { DelayTrackerService } from '../../services/delay-tracker.service';
import { DataSyncService } from '../../services/data-sync.service';
import { DelayEntityType, DelayLog, DelayStatus } from '../../models/delay-tracker.model';
import { ProjectService } from '../../services/project.service';
import { DelayEntryModalComponent, ProjectItem } from './delay-entry-modal/delay-entry-modal';
import { ConfirmationDialogComponent } from '../shared/confirmation-dialog/confirmation-dialog';

@Component({
    selector: 'app-delay-tracker',
    imports: [CommonModule, FormsModule, ReactiveFormsModule, DelayEntryModalComponent, ConfirmationDialogComponent],
    templateUrl: './delay-tracker.html',
    styleUrl: './delay-tracker.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DelayTrackerComponent implements OnInit, OnDestroy {
    private readonly delayTrackerService = inject(DelayTrackerService);
    private readonly projectService = inject(ProjectService);
    private readonly dataSyncService = inject(DataSyncService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly fb = inject(FormBuilder);

    projectId = input.required<number>();

    entries = signal<DelayLog[]>([]);
    searchQuery = signal('');
    showAddModal = signal(false);
    editingEntry = signal<DelayLog | null>(null);
    showDeleteConfirmation = signal(false);
    deletingEntry = signal<DelayLog | null>(null);
    isLoading = signal(false);
    isExporting = signal(false);
    exportError = signal<string | null>(null);

    // Selection
    selectedIds = signal<Set<number>>(new Set());
    selectAll = signal(false);

    // Bulk operations
    showBulkEditModal = signal(false);
    showBulkDeleteModal = signal(false);
    isBulkUpdating = signal(false);
    isBulkDeleting = signal(false);
    bulkEditForm!: FormGroup;

    // Snackbar
    snackbarMessage = signal<string | null>(null);
    snackbarType = signal<'success' | 'error'>('success');
    private snackbarTimer: any = null;

    // Project items (phases + tasks) for the picker
    projectItems = signal<ProjectItem[]>([]);

    // Members list for the assignee dropdown in the modal
    projectMembers = signal<any[]>([]);

    // Members map for resolving assigneeId → name
    membersMap = signal<Map<number, string>>(new Map());

    // Sorting
    sortColumn = signal<string>('delayLogId');
    sortDirection = signal<'asc' | 'desc'>('desc');
    
    private syncSubscription?: Subscription;

    filteredEntries = computed(() => {
        const query = this.searchQuery().toLowerCase();
        let result = this.entries();

        if (query) {
            const membersMap = this.membersMap();
            result = result.filter(entry => {
                const assigneeName = entry.assigneeId ? (membersMap.get(entry.assigneeId) ?? '').toLowerCase() : '';
                return (
                    entry.reason.toLowerCase().includes(query) ||
                    entry.entityType.toLowerCase().includes(query) ||
                    entry.status.toLowerCase().includes(query) ||
                    assigneeName.includes(query)
                );
            });
        }

        // Sort
        const col = this.sortColumn();
        const dir = this.sortDirection();
        result = [...result].sort((a, b) => {
            let valA: string | number = '';
            let valB: string | number = '';

            switch (col) {
                case 'entityType': valA = a.entityType; valB = b.entityType; break;
                case 'originalEndDate': valA = this.parseDateForSort(a.originalEndDate); valB = this.parseDateForSort(b.originalEndDate); break;
                case 'revisedEndDate': valA = this.parseDateForSort(a.revisedEndDate); valB = this.parseDateForSort(b.revisedEndDate); break;
                case 'delayDuration':
                    valA = this.delayTrackerService.calculateDelayDuration(a.originalEndDate, a.revisedEndDate);
                    valB = this.delayTrackerService.calculateDelayDuration(b.originalEndDate, b.revisedEndDate);
                    break;
                case 'status': valA = a.status; valB = b.status; break;
                default: valA = a.delayLogId; valB = b.delayLogId; break;
            }

            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    });

    constructor() {
        this.bulkEditForm = this.fb.group({
            entityType: [''],
            status: [''],
            originalEndDate: [''],
            revisedEndDate: [''],
            reason: [''],
            assigneeId: ['']
        });

        effect(() => {
            const pid = this.projectId();
            if (pid) {
                this.loadEntries();
                this.loadProjectItems();
            }
        }, { allowSignalWrites: true });
    }

    ngOnInit(): void {
        this.syncSubscription = this.dataSyncService.delayTrackerUpdated$.subscribe(projectId => {
            if (this.projectId() === projectId) {
                this.loadEntries();
            }
        });
    }

    ngOnDestroy(): void {
        if (this.syncSubscription) {
            this.syncSubscription.unsubscribe();
        }
    }

    loadEntries(): void {
        this.isLoading.set(true);
        this.delayTrackerService.getDelayLogs(this.projectId()).subscribe({
            next: (entries) => {
                this.entries.set(entries);
                this.isLoading.set(false);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading delay logs:', err);
                this.isLoading.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    private loadProjectItems(): void {
        const pid = this.projectId();
        forkJoin({
            phases: this.projectService.getPhases(pid),
            members: this.projectService.getProjectMembers(pid)
        }).subscribe({
            next: ({ phases, members }) => {
                // Build a members map: memberId → user display name
                const membersMap = new Map<number, string>();
                for (const m of members) {
                    membersMap.set(Number(m.memberId), m.user || '');
                }
                this.membersMap.set(membersMap);
                this.projectMembers.set(members);

                const items: ProjectItem[] = [];

                for (const phase of phases) {
                    if (!phase.phaseId) continue;

                    const assigneeMemberId = phase.projectMemberId != null ? Number(phase.projectMemberId) : null;
                    items.push({
                        id: phase.phaseId,
                        phaseId: phase.phaseId,
                        name: phase.phaseName,
                        type: 'PHASE',
                        endDate: this.normalizeDate(phase.endDate),
                        assigneeMemberId,
                        assigneeName: assigneeMemberId ? (membersMap.get(assigneeMemberId) ?? phase.assignedToName ?? '') : (phase.assignedToName ?? ''),
                        status: phase.status || 'OPEN'
                    });

                    if (phase.tasks) {
                        for (const task of phase.tasks) {
                            if (!task.taskId) continue;
                            const taskMemberId = task.assignedToProjectMemberId != null ? Number(task.assignedToProjectMemberId) : null;
                            items.push({
                                id: task.taskId,
                                phaseId: phase.phaseId,
                                name: task.taskName,
                                type: 'TASK',
                                endDate: this.normalizeDate(task.endDate),
                                assigneeMemberId: taskMemberId,
                                assigneeName: taskMemberId ? (membersMap.get(taskMemberId) ?? task.assignedToName ?? '') : (task.assignedToName ?? ''),
                                status: task.status || 'OPEN',
                                phaseName: phase.phaseName
                            });
                        }
                    }
                }

                this.projectItems.set(items);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading project items for delay tracker:', err);
            }
        });
    }

    onSearchChange(event: Event): void {
        this.searchQuery.set((event.target as HTMLInputElement).value);
    }

    openAddModal(): void {
        this.editingEntry.set(null);
        this.showAddModal.set(true);
    }

    openEditModal(entry: DelayLog): void {
        this.editingEntry.set(entry);
        this.showAddModal.set(true);
    }

    closeModal(): void {
        this.showAddModal.set(false);
        this.editingEntry.set(null);
    }

    onEntrySaved(): void {
        this.closeModal();
        // loadEntries() handled by dataSyncService subscription
    }

    onEntryUpdated(): void {
        // loadEntries() handled by dataSyncService subscription
    }

    openDeleteConfirmation(entry: DelayLog, event: Event): void {
        event.stopPropagation();
        this.deletingEntry.set(entry);
        this.showDeleteConfirmation.set(true);
    }

    cancelDelete(): void {
        this.showDeleteConfirmation.set(false);
        this.deletingEntry.set(null);
    }

    confirmDelete(): void {
        const entry = this.deletingEntry();
        if (entry) {
            this.delayTrackerService.deleteDelayLog(this.projectId(), entry.delayLogId).subscribe({
                next: () => {
                    this.dataSyncService.notifyDelayTrackerUpdated(this.projectId());
                    // loadEntries() will be called by dataSyncService subscription
                    this.cdr.markForCheck();
                },
                error: (err) => console.error('Failed to delete delay log:', err)
            });
        }
        this.showDeleteConfirmation.set(false);
        this.deletingEntry.set(null);
    }

    sortBy(column: string): void {
        if (this.sortColumn() === column) {
            this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            this.sortColumn.set(column);
            this.sortDirection.set('asc');
        }
    }

    getSortIcon(column: string): string {
        if (this.sortColumn() !== column) return '';
        return this.sortDirection() === 'asc' ? '↑' : '↓';
    }

    // ---- Selection ----------------------------------------------------------

    isSelected(id: number): boolean {
        return this.selectedIds().has(id);
    }

    toggleSelection(id: number): void {
        const current = new Set(this.selectedIds());
        if (current.has(id)) {
            current.delete(id);
        } else {
            current.add(id);
        }
        this.selectedIds.set(current);
        // Sync selectAll state
        const all = this.filteredEntries();
        this.selectAll.set(all.length > 0 && all.every(e => current.has(e.delayLogId)));
    }

    toggleSelectAll(): void {
        const next = !this.selectAll();
        this.selectAll.set(next);
        if (next) {
            this.selectedIds.set(new Set(this.filteredEntries().map(e => e.delayLogId)));
        } else {
            this.selectedIds.set(new Set());
        }
    }

    // ---- Bulk Actions -------------------------------------------------------

    clearBulkSelection(): void {
        this.selectedIds.set(new Set());
        this.selectAll.set(false);
    }

    openBulkEditModal(): void {
        this.bulkEditForm.reset({ entityType: '', status: '', originalEndDate: '', revisedEndDate: '', reason: '', assigneeId: '' });
        this.showBulkEditModal.set(true);
    }

    closeBulkEditModal(): void {
        this.showBulkEditModal.set(false);
    }

    onBulkEditSubmit(): void {
        const val = this.bulkEditForm.value;
        const ids = Array.from(this.selectedIds());
        if (ids.length === 0) return;

        // Build only the fields that were actually filled in
        const updates: Record<string, any> = {};
        if (val.entityType) updates['entityType'] = val.entityType as DelayEntityType;
        if (val.status) updates['status'] = val.status as DelayStatus;
        if (val.originalEndDate) updates['originalEndDate'] = val.originalEndDate;
        if (val.revisedEndDate) updates['revisedEndDate'] = val.revisedEndDate;
        if (val.reason?.trim()) updates['reason'] = val.reason.trim();
        if (val.assigneeId !== '' && val.assigneeId !== null) updates['assigneeId'] = Number(val.assigneeId);

        if (Object.keys(updates).length === 0) {
            this.showSnackbar('No fields changed. Please update at least one field.', 'error');
            return;
        }

        this.isBulkUpdating.set(true);
        this.cdr.markForCheck();

        this.delayTrackerService.bulkUpdateDelayLogs(this.projectId(), { ids, updates }).subscribe({
            next: (res) => {
                this.isBulkUpdating.set(false);
                this.closeBulkEditModal();
                this.dataSyncService.notifyDelayTrackerUpdated(this.projectId());
                const failed = res.failedItems?.length ?? 0;
                const success = res.successIds?.length ?? 0;
                const msg = failed > 0
                    ? `${success} updated successfully, ${failed} failed.`
                    : `${success} delay log${success !== 1 ? 's' : ''} updated successfully.`;
                this.showSnackbar(msg, failed > 0 ? 'error' : 'success');
                this.clearBulkSelection();
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.isBulkUpdating.set(false);
                this.showSnackbar('Bulk update failed. Please try again.', 'error');
                console.error('Bulk update failed:', err);
                this.cdr.markForCheck();
            }
        });
    }

    openBulkDeleteModal(): void {
        this.showBulkDeleteModal.set(true);
    }

    closeBulkDeleteModal(): void {
        this.showBulkDeleteModal.set(false);
    }

    executeBulkDelete(): void {
        const ids = Array.from(this.selectedIds());
        if (ids.length === 0) return;

        this.isBulkDeleting.set(true);
        this.cdr.markForCheck();

        this.delayTrackerService.bulkDeleteDelayLogs(this.projectId(), { ids }).subscribe({
            next: () => {
                this.isBulkDeleting.set(false);
                this.closeBulkDeleteModal();
                this.dataSyncService.notifyDelayTrackerUpdated(this.projectId());
                this.showSnackbar(`${ids.length} delay log${ids.length !== 1 ? 's' : ''} deleted successfully.`, 'success');
                this.clearBulkSelection();
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.isBulkDeleting.set(false);
                this.showSnackbar('Bulk delete failed. Please try again.', 'error');
                console.error('Bulk delete failed:', err);
                this.cdr.markForCheck();
            }
        });
    }

    private showSnackbar(message: string, type: 'success' | 'error'): void {
        if (this.snackbarTimer) clearTimeout(this.snackbarTimer);
        this.snackbarMessage.set(message);
        this.snackbarType.set(type);
        this.cdr.markForCheck();
        this.snackbarTimer = setTimeout(() => {
            this.snackbarMessage.set(null);
            this.cdr.markForCheck();
        }, 4000);
    }

    // ---- Export -------------------------------------------------------------

    exportDelayReport(): void {
        const ids = Array.from(this.selectedIds());
        if (ids.length === 0) {
            this.exportError.set('Please select at least one delay entry to generate a report.');
            setTimeout(() => this.exportError.set(null), 4000);
            this.cdr.markForCheck();
            return;
        }

        this.isExporting.set(true);
        this.cdr.markForCheck();

        this.delayTrackerService.exportDelayReport(this.projectId(), ids).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'delay-report.pdf';
                a.click();
                window.URL.revokeObjectURL(url);
                this.isExporting.set(false);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Failed to export delay report:', err);
                this.exportError.set('Failed to generate report. Please try again.');
                setTimeout(() => this.exportError.set(null), 4000);
                this.isExporting.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    // ---- Display Helpers -----------------------------------------------------

    /** Resolve assigneeId → display name using the members map */
    getAssigneeName(assigneeId: number | null): string {
        if (!assigneeId) return '';
        return this.membersMap().get(assigneeId) ?? `Member #${assigneeId}`;
    }

    /** Get the phaseId or taskId-linked item name from projectItems */
    getItemName(entry: DelayLog): string {
        const items = this.projectItems();
        if (entry.entityType === 'PHASE' && entry.phaseId) {
            return items.find(i => i.type === 'PHASE' && i.id === entry.phaseId)?.name ?? `Phase #${entry.phaseId}`;
        }
        if (entry.entityType === 'TASK' && entry.taskId) {
            return items.find(i => i.type === 'TASK' && i.id === entry.taskId)?.name ?? `Task #${entry.taskId}`;
        }
        return '—';
    }

    formatDate(date: string): string {
        if (!date) return '—';
        // Accept dd-MM-yyyy (server) or yyyy-MM-dd
        let d: Date;
        const parts = date.split('-');
        if (parts[0].length === 2) {
            // dd-MM-yyyy
            d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
            d = new Date(date);
        }
        if (isNaN(d.getTime())) return date;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    formatDelayDuration(entry: DelayLog): string {
        const days = this.delayTrackerService.calculateDelayDuration(entry.originalEndDate, entry.revisedEndDate);
        if (days <= 0) return 'No delay';
        if (days === 1) return '1 day';
        if (days < 7) return `${days} days`;
        const weeks = Math.floor(days / 7);
        const remainingDays = days % 7;
        if (remainingDays === 0) return weeks === 1 ? '1 week' : `${weeks} weeks`;
        return `${weeks}w ${remainingDays}d`;
    }

    getDelayDurationClass(entry: DelayLog): string {
        const days = this.delayTrackerService.calculateDelayDuration(entry.originalEndDate, entry.revisedEndDate);
        if (days <= 0) return 'text-green-600';
        if (days <= 7) return 'text-yellow-600';
        if (days <= 30) return 'text-orange-600';
        return 'text-red-600';
    }

    getStatusClass(status: string): string {
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
        const statusMap: Record<string, string> = {
            'OPEN': 'Open',
            'ONGOING': 'Ongoing',
            'COMPLETED': 'Completed',
            'ON_HOLD': 'On Hold',
            'CANCELLED': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    getTypeClass(type: string): string {
        return type === 'PHASE'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-indigo-100 text-indigo-700';
    }

    getInitials(name: string): string {
        if (!name) return '';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    getAvatarColor(name: string): string {
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

    // ---- Private Helpers ----------------------------------------------------

    private normalizeDate(date: string | undefined): string {
        if (!date) return '';
        // If it's dd-MM-yyyy, convert to yyyy-MM-dd for HTML date input
        const parts = date.split('-');
        if (parts.length === 3 && parts[0].length === 2) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        // Already yyyy-MM-dd or ISO string; trim to date part
        return date.substring(0, 10);
    }

    private parseDateForSort(date: string): number {
        if (!date) return 0;
        const parts = date.split('-');
        if (parts[0].length === 2) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
        }
        return new Date(date).getTime();
    }
}
