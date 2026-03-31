import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, input, output, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { TimelineService } from '../../../services/timeline.service';
import { TimeScale, TimelineGridCell, PhaseDependency } from '../../../models/timeline.model';
import { Phase, Task } from '../../../models/phase.model';
import { toPng } from 'html-to-image';
// import html2canvas from 'html2canvas';

interface PhaseWithTasks extends Phase {
    tasks: Task[];
    completionPercentage: number;
}

interface ExportForm {
    timelineView: FormControl<TimeScale>;
    startDate: FormControl<Date | null>;
    endDate: FormControl<Date | null>;
}

@Component({
    selector: 'app-export-timeline-modal',
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './export-timeline-modal.html',
    styleUrl: './export-timeline-modal.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExportTimelineModalComponent implements OnInit, AfterViewInit {
    private timelineService = inject(TimelineService);
    private cdr = inject(ChangeDetectorRef);

    // Inputs
    isOpen = input.required<boolean>();
    projectStartDate = input.required<string>();
    projectEndDate = input.required<string>();
    phases = input.required<PhaseWithTasks[]>();
    currentTimeScale = input.required<TimeScale>();
    expandedPhases = input.required<Set<number>>();
    dependencies = input<PhaseDependency[]>([]);

    // Outputs
    close = output<void>();

    // ViewChild reference to the preview container panel for scaling calculations
    @ViewChild('previewContainer', { read: ElementRef }) previewContainerRef?: ElementRef<HTMLDivElement>;

    // Expose TimeScale enum to template
    TimeScale = TimeScale;

    // Local state derived from the form (kept in signals so computed() reacts)
    selectedTimelineView = signal<TimeScale>(TimeScale.MONTH);
    selectedStartDate = signal<Date | null>(null);
    selectedEndDate = signal<Date | null>(null);

    // State signals
    isExporting = signal<boolean>(false);
    errorMessage = signal<string>('');

    // Form
    exportForm!: FormGroup<ExportForm>;

    // Computed preview data
    previewData = computed(() => {
        const startDate = this.selectedStartDate();
        const endDate = this.selectedEndDate();
        const timelineView = this.selectedTimelineView();

        if (!startDate || !endDate || !this.phases()) {
            return { phases: [], columns: [], hasData: false };
        }

        // Filter phases and tasks that intersect with selected date range
        const filteredPhases = this.filterPhasesByDateRange(
            this.phases(),
            startDate,
            endDate
        );

        // Generate timeline columns for preview
        const columns = this.generatePreviewColumns(startDate, endDate, timelineView);

        return {
            phases: filteredPhases,
            columns,
            hasData: filteredPhases.length > 0
        };
    });

    dependencyLines = computed(() => {
        const deps = this.dependencies() || [];
        const { phases: phasesData, columns } = this.previewData();
        
        // This triggers reactivity on expand/collapse changes if we passed expanded phases or timelineView changed
        this.expandedPhases(); 

        if (deps.length === 0 || phasesData.length === 0 || columns.length === 0) return [];

        return deps.map(dep => {
            const predPhase = phasesData.find(p => p.phaseId === dep.predecessorId);
            const succPhase = phasesData.find(p => p.phaseId === dep.successorId);

            if (!predPhase || !succPhase) return null;

            const predBar = this.calculateBarPosition(predPhase.startDate, predPhase.endDate);
            const succBar = this.calculateBarPosition(succPhase.startDate, succPhase.endDate);

            const predY = this.getPhaseRowCenterY(dep.predecessorId, phasesData);
            const succY = this.getPhaseRowCenterY(dep.successorId, phasesData);

            if (predY === null || succY === null) return null;

            const predLeft = predBar.left + 8;
            const predRight = predBar.left + predBar.width - 8;
            const succLeft = succBar.left + 8;
            const succRight = succBar.left + succBar.width - 8;

            let points: { x: number; y: number }[] = [];
            let labelX = 0, labelY = 0;
            const margin = 16;
            const yMid = predY + (succY - predY) / 2;

            switch (dep.dependencyType) {
                case 'FS':
                    if (predRight + margin < succLeft - margin) {
                        const midX = predRight + margin;
                        points = [
                            { x: predRight, y: predY },
                            { x: midX, y: predY },
                            { x: midX, y: succY },
                            { x: succLeft, y: succY }
                        ];
                        labelX = midX;
                        labelY = yMid;
                    } else {
                        const midX1 = predRight + margin;
                        const midX2 = succLeft - margin;
                        points = [
                            { x: predRight, y: predY },
                            { x: midX1, y: predY },
                            { x: midX1, y: yMid },
                            { x: midX2, y: yMid },
                            { x: midX2, y: succY },
                            { x: succLeft, y: succY }
                        ];
                        labelX = midX1 + (midX2 - midX1) / 2;
                        labelY = yMid - 6;
                    }
                    break;
                case 'SS':
                    const leftX_SS = Math.min(predLeft, succLeft) - margin;
                    points = [
                        { x: predLeft, y: predY },
                        { x: leftX_SS, y: predY },
                        { x: leftX_SS, y: succY },
                        { x: succLeft, y: succY }
                    ];
                    labelX = leftX_SS;
                    labelY = yMid;
                    break;
                case 'FF':
                    const rightX_FF = Math.max(predRight, succRight) + margin;
                    points = [
                        { x: predRight, y: predY },
                        { x: rightX_FF, y: predY },
                        { x: rightX_FF, y: succY },
                        { x: succRight, y: succY }
                    ];
                    labelX = rightX_FF;
                    labelY = yMid;
                    break;
                case 'SF':
                    if (predLeft - margin > succRight + margin) {
                        const midX_SF = succRight + margin;
                        points = [
                            { x: predLeft, y: predY },
                            { x: midX_SF, y: predY },
                            { x: midX_SF, y: succY },
                            { x: succRight, y: succY }
                        ];
                        labelX = midX_SF;
                        labelY = yMid;
                    } else {
                        const midX1_SF = predLeft - margin;
                        const midX2_SF = succRight + margin;
                        points = [
                            { x: predLeft, y: predY },
                            { x: midX1_SF, y: predY },
                            { x: midX1_SF, y: yMid },
                            { x: midX2_SF, y: yMid },
                            { x: midX2_SF, y: succY },
                            { x: succRight, y: succY }
                        ];
                        labelX = midX1_SF + (midX2_SF - midX1_SF) / 2;
                        labelY = yMid - 6;
                    }
                    break;
            }

            const path = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

            return {
                dep,
                path,
                labelX,
                labelY,
                points
            };
        }).filter(line => line !== null);
    });

    /** Calculate Y center position for a phase row */
    getPhaseRowCenterY(phaseId: number, phasesData: PhaseWithTasks[]): number | null {
        let y = 0;
        const expanded = this.expandedPhases();

        for (const phase of phasesData) {
            if (phase.phaseId === phaseId) {
                return y + 32; // Half of 64px phase row height
            }
            y += 64; // Phase row height
            if (phase.phaseId && expanded.has(phase.phaseId) && phase.tasks) {
                y += phase.tasks.length * 48; // Expanded task rows
            }
        }
        return null;
    }

    ngOnInit() {
        // Get current date for default month view
        const today = new Date();
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        // Initialize form with MONTH as default view and current month dates
        this.exportForm = new FormGroup<ExportForm>({
            timelineView: new FormControl(TimeScale.MONTH, { nonNullable: true }),
            startDate: new FormControl<Date | null>(currentMonthStart, [Validators.required]),
            endDate: new FormControl<Date | null>(currentMonthEnd, [Validators.required])
        }, { validators: [this.dateRangeValidator.bind(this)] });

        // Seed signals with initial form values
        this.selectedTimelineView.set(TimeScale.MONTH);
        this.selectedStartDate.set(currentMonthStart);
        this.selectedEndDate.set(currentMonthEnd);

        // Keep signals in sync with form changes so preview recomputes
        this.exportForm.valueChanges.subscribe(value => {
            const newView = value.timelineView ?? TimeScale.MONTH;
            const previousView = this.selectedTimelineView();

            this.selectedTimelineView.set(newView);
            this.selectedStartDate.set(this.getDateFromFormValue(value.startDate));
            this.selectedEndDate.set(this.getDateFromFormValue(value.endDate));

            // If view changed to QUARTER, set dates to current quarter
            if (newView === TimeScale.QUARTER && previousView !== TimeScale.QUARTER) {
                const quarterDates = this.getCurrentQuarterDates();
                this.exportForm.patchValue({
                    startDate: quarterDates.start,
                    endDate: quarterDates.end
                }, { emitEvent: false });
                this.selectedStartDate.set(quarterDates.start);
                this.selectedEndDate.set(quarterDates.end);
            }
            // If view changed to MONTH, set dates to current month
            else if (newView === TimeScale.MONTH && previousView !== TimeScale.MONTH) {
                const monthDates = this.getCurrentMonthDates();
                this.exportForm.patchValue({
                    startDate: monthDates.start,
                    endDate: monthDates.end
                }, { emitEvent: false });
                this.selectedStartDate.set(monthDates.start);
                this.selectedEndDate.set(monthDates.end);
            }
        });
    }

    ngAfterViewInit() {
        // Force a change detection cycle to ensure the view scaling is calculated correctly
        // after the view (and container dimensions) are fully initialized.
        // This fixes the initial "zoomed in" (scale 1) issue.
        this.cdr.detectChanges();
    }

    // Helper to get current month date range
    private getCurrentMonthDates(): { start: Date; end: Date } {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start, end };
    }

    // Helper to get current quarter date range
    private getCurrentQuarterDates(): { start: Date; end: Date } {
        const today = new Date();
        const quarter = Math.floor(today.getMonth() / 3);
        const start = new Date(today.getFullYear(), quarter * 3, 1);
        const end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
        return { start, end };
    }

    // Custom validator to ensure start date <= end date
    private dateRangeValidator(control: AbstractControl): { [key: string]: boolean } | null {
        const group = control as FormGroup;
        const startDate = group.get('startDate')?.value;
        const endDate = group.get('endDate')?.value;

        if (startDate && endDate && startDate > endDate) {
            return { dateRangeInvalid: true };
        }

        return null;
    }

    // Filter phases and tasks by date range
    private filterPhasesByDateRange(
        phases: PhaseWithTasks[],
        startDate: Date,
        endDate: Date
    ): PhaseWithTasks[] {
        return phases
            .map(phase => {
                const phaseStart = this.timelineService.parseDate(phase.startDate);
                const phaseEnd = this.timelineService.parseDate(phase.endDate);

                if (!phaseStart || !phaseEnd) return null;

                // Check if phase intersects with date range
                const phaseIntersects = phaseStart <= endDate && phaseEnd >= startDate;

                if (!phaseIntersects) return null;

                // Filter tasks that intersect with date range
                const filteredTasks = (phase.tasks || []).filter(task => {
                    const taskStart = this.timelineService.parseDate(task.startDate);
                    const taskEnd = this.timelineService.parseDate(task.endDate);

                    if (!taskStart || !taskEnd) return false;

                    return taskStart <= endDate && taskEnd >= startDate;
                });

                return {
                    ...phase,
                    tasks: filteredTasks,
                    completionPercentage: phase.completionPercentage
                };
            })
            .filter(phase => phase !== null) as PhaseWithTasks[];
    }

    // Generate preview columns (same logic as main timeline)
    private generatePreviewColumns(startDate: Date, endDate: Date, scale: TimeScale): TimelineGridCell[] {
        const columns: TimelineGridCell[] = [];
        let currentDate = new Date(startDate);
        let columnId = 0;

        if (scale === TimeScale.WEEK) {
            while (currentDate <= endDate) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 6);

                const dailyLabels: string[] = [];
                for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
                    const dayDate = new Date(weekStart);
                    dayDate.setDate(dayDate.getDate() + dayOffset);

                    if (dayDate > endDate) break;

                    const dayNum = dayDate.getDate();
                    dailyLabels.push(`${dayNum}`);
                }

                columns.push({
                    id: `week-${columnId++}`,
                    label: dailyLabels.join('|'),
                    startDate: weekStart,
                    endDate: weekEnd,
                    isCurrent: false,
                    isToday: false
                });

                currentDate.setDate(currentDate.getDate() + 7);
            }
        } else if (scale === TimeScale.MONTH) {
            while (currentDate <= endDate) {
                const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
                const label = monthNames[monthStart.getMonth()];

                columns.push({
                    id: `month-${columnId++}`,
                    label,
                    startDate: monthStart,
                    endDate: monthEnd,
                    isCurrent: false,
                    isToday: false
                });

                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        } else if (scale === TimeScale.QUARTER) {
            while (currentDate <= endDate) {
                const quarter = Math.floor(currentDate.getMonth() / 3);
                const quarterStart = new Date(currentDate.getFullYear(), quarter * 3, 1);
                const quarterEnd = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);

                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
                const startMonth = monthNames[quarter * 3];
                const endMonth = monthNames[quarter * 3 + 2];
                const label = `${startMonth} - ${endMonth}`;

                columns.push({
                    id: `quarter-${columnId++}`,
                    label,
                    startDate: quarterStart,
                    endDate: quarterEnd,
                    isCurrent: false,
                    isToday: false
                });

                currentDate.setMonth(currentDate.getMonth() + 3);
            }
        }

        return columns;
    }

    // Helper to convert form value to Date (handles both Date objects and strings)
    private getDateFromFormValue(value: Date | string | null | undefined): Date | null {
        if (!value) return null;
        if (value instanceof Date) return value;
        // If it's a string, parse it
        return this.timelineService.parseDate(value);
    }

    // --- Preview layout helpers for consistent sizing ---

    private readonly dayMs = 1000 * 60 * 60 * 24;

    private getPreviewBounds(): { start: Date; end: Date } | null {
        const start = this.selectedStartDate();
        const end = this.selectedEndDate();
        if (!start || !end) {
            return null;
        }
        return { start, end };
    }

    // Check if a phase is expanded (mirrors the main timeline's expansion state)
    isPhaseExpanded(phaseId: number | undefined): boolean {
        if (!phaseId) return false;
        return this.expandedPhases().has(phaseId);
    }

    // Base day width for the WEEK view
    readonly baseDayWidth = 40;

    // Uniform column width matching the main timeline (dayWidth * 7 for all views)
    getColumnWidth(): number {
        return this.baseDayWidth * 7; // 280px per column
    }

    // Total width of all preview columns combined
    getTotalColumnsWidth(): number {
        const { columns } = this.previewData();
        if (!columns || columns.length === 0) {
            return 0;
        }
        return columns.length * this.getColumnWidth();
    }

    // Helper: calendar day difference immune to timezone issues
    private diffDays(a: Date, b: Date): number {
        const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
    }

    // Calculate bar position for preview - matches main timeline logic
    calculateBarPosition(startDate: string | undefined, endDate: string | undefined): { left: number; width: number } {
        if (!startDate || !endDate) {
            return { left: 0, width: 0 };
        }

        const barStart = this.timelineService.parseDate(startDate);
        const barEnd = this.timelineService.parseDate(endDate);

        if (!barStart || !barEnd) {
            return { left: 0, width: 0 };
        }

        const timelineView = this.selectedTimelineView();
        const columnWidth = this.getColumnWidth();
        const columns = this.previewData().columns;

        if (columns.length === 0) {
            return { left: 0, width: 0 };
        }

        if (timelineView === TimeScale.WEEK) {
            // Week view: column-relative day-based positioning
            const gridOrigin = columns[0].startDate;
            const dayWidth = this.baseDayWidth;
            const startDays = this.diffDays(gridOrigin, barStart);
            const endDays = this.diffDays(gridOrigin, barEnd);
            const left = startDays * dayWidth;
            const width = Math.max((endDays - startDays + 1) * dayWidth, dayWidth);
            return { left: Math.max(0, left), width };
        }

        // Month/Quarter: proportional positioning using calendar days
        let left = 0;
        let width = 0;
        let cumulativeLeft = 0;
        let foundStart = false;

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const colStart = column.startDate;
            const colEnd = column.endDate;
            const colDays = this.diffDays(colStart, colEnd) + 1;

            if (!foundStart && barStart >= colStart && barStart <= colEnd) {
                const daysIntoCol = this.diffDays(colStart, barStart);
                const percentIntoColumn = colDays > 0 ? daysIntoCol / colDays : 0;
                left = cumulativeLeft + (percentIntoColumn * columnWidth);
                foundStart = true;
            }

            if (barEnd >= colStart && barEnd <= colEnd) {
                const daysIntoCol = this.diffDays(colStart, barEnd) + 1;
                const percentIntoColumn = colDays > 0 ? daysIntoCol / colDays : 1;
                const endPosition = cumulativeLeft + (percentIntoColumn * columnWidth);
                width = endPosition - left;
                break;
            } else if (!foundStart && barStart < colStart && barEnd >= colStart) {
                left = cumulativeLeft;
                foundStart = true;
            }

            cumulativeLeft += columnWidth;
        }

        if (foundStart && width === 0) {
            width = cumulativeLeft - left;
        }

        // Ensure minimum width
        width = Math.max(width, this.baseDayWidth);
        return { left: Math.max(0, left), width };
    }

    // Get phase color (returns hex colors for html2canvas compatibility)
    getPhaseColor(index: number): string {
        const colors = [
            '#8c2d1b',      // Red-brown (matching main brand color)
            '#059669',      // Emerald
            '#9333ea',      // Purple
            '#d97706',      // Amber
            '#ec4899',      // Pink
            '#4f46e5',      // Indigo
            '#0d9488',      // Teal
            '#ea580c'       // Orange
        ];
        return colors[index % colors.length];
    }

    // Format date for display
    formatDate(dateString: string | undefined): string {
        return this.timelineService.formatDateShort(dateString);
    }

    // Get form date value as yyyy-MM-dd string for native date input
    getFormDateString(controlName: 'startDate' | 'endDate'): string {
        const date = controlName === 'startDate' ? this.selectedStartDate() : this.selectedEndDate();
        if (!date) return '';
        return this.timelineService.formatDateForAPI(date);
    }

    // Handle native date input change
    onDateInput(controlName: 'startDate' | 'endDate', event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = input.value; // yyyy-MM-dd format
        if (!value) return;

        const parsed = this.timelineService.parseDate(value);
        if (!parsed) return;

        if (controlName === 'startDate') {
            this.selectedStartDate.set(parsed);
            this.exportForm.get('startDate')?.setValue(parsed);
        } else {
            this.selectedEndDate.set(parsed);
            this.exportForm.get('endDate')?.setValue(parsed);
        }
    }

    // Get month label for a week column
    getWeekMonthLabel(column: TimelineGridCell): string {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayLabels = column.label.split('|');
        const monthsInWeek = new Set<number>();

        // Reconstruct dates from the column's startDate
        for (let i = 0; i < dayLabels.length; i++) {
            const dayDate = new Date(column.startDate);
            dayDate.setDate(dayDate.getDate() + i);
            monthsInWeek.add(dayDate.getMonth());
        }

        const monthsArray = Array.from(monthsInWeek).sort();
        return monthsArray.map(m => monthNames[m]).join(' / ');
    }

    // Constants for preview layout
    private readonly nameColumnWidth = 300;
    private readonly headerHeight = 60; // header rows height
    private readonly phaseRowHeight = 64;
    private readonly taskRowHeight = 48;

    /**
     * Total pixel width of the preview content (name column + all timeline columns).
     */
    getPreviewContentWidth(): number {
        return this.nameColumnWidth + this.getTotalColumnsWidth();
    }

    /**
     * Total pixel height of the preview content (header + phase rows + task rows).
     */
    getPreviewContentHeight(): number {
        const data = this.previewData();
        if (!data.hasData) return 0;

        let totalHeight = this.headerHeight;
        for (const phase of data.phases) {
            totalHeight += this.phaseRowHeight; // 64px per phase
            if (this.isPhaseExpanded(phase.phaseId) && phase.tasks) {
                totalHeight += phase.tasks.length * this.taskRowHeight; // 48px per task
            }
        }

        return totalHeight;
    }

    /**
     * Compute a CSS transform that scales and translates the preview
     * so it fits entirely within the container panel and is centred.
     */
    getPreviewTransform(): string {
        if (!this.previewContainerRef) {
            return 'scale(1)';
        }

        const container = this.previewContainerRef.nativeElement;
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        if (containerW === 0 || containerH === 0) {
            return 'scale(1)';
        }

        const contentW = this.getPreviewContentWidth();
        const contentH = this.getPreviewContentHeight();

        if (contentW === 0 || contentH === 0) {
            return 'scale(1)';
        }

        // Leave a margin around the preview
        const margin = 24;
        const availW = containerW - margin * 2;
        const availH = containerH - margin * 2;

        const scaleX = availW / contentW;
        const scaleY = availH / contentH;
        const scale = Math.min(scaleX, scaleY, 1);

        // After scaling, the rendered size is contentW*scale × contentH*scale.
        // Centre it by translating from the top-left corner.
        const renderedW = contentW * scale;
        const renderedH = contentH * scale;
        const tx = (containerW - renderedW) / 2;
        const ty = (containerH - renderedH) / 2;

        return `translate(${tx}px, ${ty}px) scale(${scale})`;
    }


    // Export timeline as image
    async exportTimeline() {
        if (this.exportForm.invalid || this.isExporting()) {
            return;
        }

        this.isExporting.set(true);
        this.errorMessage.set('');

        try {
            const exportSource = document.getElementById('timeline-export-source');
            if (!exportSource) {
                throw new Error('Export source element not found');
            }

            // Capture the hidden export source directly using html-to-image
            const dataUrl = await toPng(exportSource, {
                pixelRatio: 2, // Equivalent to scale: 2
                backgroundColor: '#ffffff',
                width: this.getPreviewContentWidth(),
                height: this.getPreviewContentHeight(),
                style: {
                    opacity: '1', // Ensure captured image is fully opaque even if source is hidden
                    visibility: 'visible'
                }
                // html-to-image handles scroll/window dimensions differently, usually automatically
            });

            /*
            // OLD html2canvas implementation kept for reference
            // Capture the hidden export source directly.
            // Since it's a live part of the DOM (just hidden with z-index),
            // it has correct styles and layout.
            const canvas = await html2canvas(exportSource, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
                width: this.getPreviewContentWidth(),
                height: this.getPreviewContentHeight(),
                scrollX: 0,
                scrollY: 0,
                windowWidth: document.documentElement.clientWidth,
                windowHeight: document.documentElement.clientHeight
            });
            */

            // Generate filename
            const startDateValue = this.exportForm.get('startDate')?.value;
            const endDateValue = this.exportForm.get('endDate')?.value;

            const startDate = this.getDateFromFormValue(startDateValue);
            const endDate = this.getDateFromFormValue(endDateValue);

            if (!startDate || !endDate) {
                throw new Error('Invalid dates for export');
            }

            const startStr = this.timelineService.formatDateForAPI(startDate);
            const endStr = this.timelineService.formatDateForAPI(endDate);
            const filename = `project-timeline-${startStr}-to-${endStr}.png`;

            // Download image
            const link = document.createElement('a');
            link.download = filename;
            // link.href = canvas.toDataURL('image/png'); // html2canvas way
            link.href = dataUrl; // html-to-image returns data URL directly
            link.click();

            // Close modal after successful export
            this.onClose();
        } catch (error) {
            console.error('Error exporting timeline:', error);
            this.errorMessage.set('Failed to export timeline. Please try again.');
        } finally {
            this.isExporting.set(false);
        }
    }

    // Handle modal close
    onClose() {
        this.close.emit();
    }

    // Check if form is valid
    isFormValid(): boolean {
        return this.exportForm?.valid || false;
    }

    // Get validation error message
    getValidationError(): string {
        if (!this.exportForm) return '';

        const startDate = this.exportForm.get('startDate');
        const endDate = this.exportForm.get('endDate');

        if (startDate?.hasError('required')) {
            return 'Start date is required';
        }

        if (endDate?.hasError('required')) {
            return 'End date is required';
        }

        if (this.exportForm.hasError('dateRangeInvalid')) {
            return 'Start date must be before or equal to end date';
        }

        return '';
    }
}
