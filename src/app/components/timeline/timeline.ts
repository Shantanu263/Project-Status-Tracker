import {
    Component,
    ChangeDetectionStrategy,
    signal,
    computed,
    inject,
    OnInit,
    AfterViewInit,
    ViewChild,
    ElementRef,
    effect,
    HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimelineService } from '../../services/timeline.service';
import { ProjectService } from '../../services/project.service';
import { SelectedProjectService } from '../../services/selected-project.service';
import { Phase, Task } from '../../models/phase.model';
import { DataSyncService } from '../../services/data-sync.service';
import {
    TimeScale,
    TimelineGridCell,
    TimelineBar,
    TimelineRow,
    DragState,
    TimelineBounds
} from '../../models/timeline.model';

interface PhaseWithTasks extends Phase {
    tasks: Task[];
    completionPercentage: number;
}

// Extended interface to store actual day count for each column
interface TimelineGridCellExtended extends TimelineGridCell {
    actualDays?: number; // Actual number of days in this column
    monthLabel?: string; // Month label for week columns (e.g., "Jan / Feb")
}

@Component({
    selector: 'app-timeline',
    imports: [CommonModule, FormsModule],
    templateUrl: './timeline.html',
    styleUrl: './timeline.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineComponent implements OnInit, AfterViewInit {
    private timelineService = inject(TimelineService);
    private projectService = inject(ProjectService);
    private selectedProjectService = inject(SelectedProjectService);
    private readonly dataSyncService = inject(DataSyncService);

    // ViewChild references for scroll synchronization
    @ViewChild('timelineHeader') timelineHeaderRef!: ElementRef<HTMLDivElement>;
    @ViewChild('timelineBody') timelineBodyRef!: ElementRef<HTMLDivElement>;
    @ViewChild('horizontalScrollbar') horizontalScrollbarRef!: ElementRef<HTMLDivElement>;

    // Expose TimeScale enum to template
    TimeScale = TimeScale;

    // Core data
    phases = signal<PhaseWithTasks[]>([]);
    selectedProject = this.selectedProjectService.getSelectedProject();

    // Timeline configuration
    timeScale = signal<TimeScale>(TimeScale.WEEK);
    timelineColumns = signal<TimelineGridCellExtended[]>([]);

    // Live resize state for visual feedback during drag
    liveResizeState = signal<{ barId: string; left: number; width: number; startDate: string; endDate: string } | null>(null);
    timelineBounds = signal<TimelineBounds | null>(null);

    // UI state
    expandedPhases = signal<Set<number>>(new Set());
    dragState = signal<DragState | null>(null);
    todayPosition = signal<number>(0);

    // Tooltip state
    hoveredPhase = signal<{ phase: PhaseWithTasks; index: number; x: number; y: number; showAbove: boolean } | null>(null);
    hoveredTask = signal<{ task: Task; x: number; y: number; showAbove: boolean } | null>(null);

    // Loading and error states
    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    // Computed values
    timelineRows = computed(() => {
        const rows: TimelineRow[] = [];
        const phasesData = this.phases();
        const expanded = this.expandedPhases();

        phasesData.forEach(phase => {
            // Add phase row
            rows.push({
                id: `phase-${phase.phaseId}`,
                type: 'phase',
                phaseId: phase.phaseId,
                name: phase.phaseName,
                startDate: phase.startDate,
                endDate: phase.endDate,
                progress: phase.completionPercentage,
                completedAt: phase.completedAt,
                isExpanded: expanded.has(phase.phaseId!),
                level: 0
            });

            // Add task rows if expanded
            if (expanded.has(phase.phaseId!)) {
                phase.tasks?.forEach(task => {
                    rows.push({
                        id: `task-${task.taskId}`,
                        type: 'task',
                        phaseId: phase.phaseId,
                        taskId: task.taskId,
                        name: task.taskName,
                        startDate: task.startDate,
                        endDate: task.endDate,
                        completedAt: task.completedAt,
                        assignedToName: task.assignedToName,
                        status: task.status,
                        level: 1
                    });
                });
            }
        });

        return rows;
    });

    constructor() {
        // Reload when project changes
        effect(() => {
            const project = this.selectedProject();
            if (project?.projectId) {
                this.loadPhases(project.projectId);
            }
        });

        // Initialize scroll sync and auto-center after phases are loaded
        effect(() => {
            const phasesData = this.phases();
            const isLoadingState = this.isLoading();

            // Wait for phases to load and DOM to render
            if (phasesData.length > 0 && !isLoadingState) {
                setTimeout(() => {
                    this.initializeScrollSync();
                    // Auto-center on today after timeline is fully rendered
                    this.scrollToToday();
                }, 150);
            }
        });
    }

    ngOnInit() {
        const project = this.selectedProject();
        if (project?.projectId) {
            this.loadPhases(project.projectId);
        }

        this.dataSyncService.phasesUpdated$.subscribe(projectId => {
            if (projectId === this.selectedProject().projectId) {
                this.loadPhases(projectId);
            }
        });

        // Subscribe to task updates from other components
        this.dataSyncService.tasksUpdated$.subscribe(({ projectId }) => {
            if (projectId === this.selectedProject().projectId) {
                this.loadPhases(projectId);
            }
        });
    }

    ngAfterViewInit() {
        // Scroll sync and auto-centering are handled in the effect
        // after data is loaded, so this is just a placeholder for the lifecycle hook
    }

    private scrollSyncInitialized = false;

    private initializeScrollSync() {
        // Prevent duplicate initialization
        if (this.scrollSyncInitialized) {
            console.log('Scroll sync already initialized, skipping...');
            return;
        }

        // Three-way scroll synchronization: header, body, and horizontal scrollbar
        if (this.timelineHeaderRef && this.timelineBodyRef && this.horizontalScrollbarRef) {
            const header = this.timelineHeaderRef.nativeElement;
            const bodyInner = this.timelineBodyRef.nativeElement; // This is timeline-body-inner
            const scrollbar = this.horizontalScrollbarRef.nativeElement;

            console.log('Timeline scroll sync initialized');
            console.log('Header:', header);
            console.log('Body Inner:', bodyInner);
            console.log('Scrollbar:', scrollbar);

            // Flags to prevent infinite loop
            let isHeaderScrolling = false;
            let isScrollbarScrolling = false;
            let isBodyScrolling = false;

            // Sync from horizontal scrollbar to header and body
            scrollbar.addEventListener('scroll', () => {
                if (!isHeaderScrolling && !isBodyScrolling) {
                    isScrollbarScrolling = true;
                    const scrollLeft = scrollbar.scrollLeft;
                    header.scrollLeft = scrollLeft;
                    bodyInner.scrollLeft = scrollLeft;
                    requestAnimationFrame(() => {
                        isScrollbarScrolling = false;
                    });
                }
            });

            // Sync from header to scrollbar and body
            header.addEventListener('scroll', () => {
                if (!isScrollbarScrolling && !isBodyScrolling) {
                    isHeaderScrolling = true;
                    const scrollLeft = header.scrollLeft;
                    scrollbar.scrollLeft = scrollLeft;
                    bodyInner.scrollLeft = scrollLeft;
                    requestAnimationFrame(() => {
                        isHeaderScrolling = false;
                    });
                }
            });

            // Sync from body to header and scrollbar (optional, for mouse wheel on body)
            bodyInner.addEventListener('scroll', () => {
                if (!isHeaderScrolling && !isScrollbarScrolling) {
                    isBodyScrolling = true;
                    const scrollLeft = bodyInner.scrollLeft;
                    header.scrollLeft = scrollLeft;
                    scrollbar.scrollLeft = scrollLeft;
                    requestAnimationFrame(() => {
                        isBodyScrolling = false;
                    });
                }
            });

            this.scrollSyncInitialized = true;
            console.log('Scroll sync successfully initialized');
        } else {
            console.error('Timeline scroll sync FAILED - missing refs:', {
                header: !!this.timelineHeaderRef,
                body: !!this.timelineBodyRef,
                scrollbar: !!this.horizontalScrollbarRef
            });
        }
    }

    /**
     * Load phases and tasks from backend
     */
    loadPhases(projectId: number) {
        this.isLoading.set(true);
        this.errorMessage.set('');

        this.projectService.getPhases(projectId).subscribe({
            next: (phases) => {
                if (phases.length === 0) {
                    this.phases.set([]);
                    this.calculateTimeline([]);
                    this.isLoading.set(false);
                    return;
                }

                const phasesWithTasks: PhaseWithTasks[] = [];
                let loadedCount = 0;

                phases.forEach((phase) => {
                    if (phase.phaseId) {
                        this.projectService.getTasks(projectId, phase.phaseId).subscribe({
                            next: (tasks) => {
                                const completedTasks = tasks.filter(t => t.status === 'DONE' || t.completedAt).length;
                                const completionPercentage = tasks.length > 0
                                    ? Math.round((completedTasks / tasks.length) * 100)
                                    : 0;

                                phasesWithTasks.push({
                                    ...phase,
                                    tasks,
                                    completionPercentage
                                });

                                loadedCount++;
                                if (loadedCount === phases.length) {
                                    // Sort by start date
                                    phasesWithTasks.sort((a, b) => {
                                        const dateA = this.timelineService.parseDate(a.startDate);
                                        const dateB = this.timelineService.parseDate(b.startDate);
                                        if (!dateA || !dateB) return 0;
                                        return dateA.getTime() - dateB.getTime();
                                    });
                                    this.phases.set(phasesWithTasks);
                                    this.calculateTimeline(phasesWithTasks);
                                    this.isLoading.set(false);
                                }
                            },
                            error: (err) => {
                                console.error('Error loading tasks for phase', phase.phaseId, err);
                                phasesWithTasks.push({
                                    ...phase,
                                    tasks: [],
                                    completionPercentage: 0
                                });
                                loadedCount++;
                                if (loadedCount === phases.length) {
                                    this.phases.set(phasesWithTasks);
                                    this.calculateTimeline(phasesWithTasks);
                                    this.isLoading.set(false);
                                }
                            }
                        });
                    }
                });
            },
            error: (err) => {
                console.error('Error loading phases:', err);
                this.errorMessage.set('Failed to load timeline data. Please try again.');
                this.phases.set([]);
                this.isLoading.set(false);
            }
        });
    }

    /**
     * Calculate timeline grid based on project dates and time scale
     */
    calculateTimeline(phases: PhaseWithTasks[]) {
        const project = this.selectedProject();
        if (!project) {
            this.timelineColumns.set([]);
            return;
        }

        const projectStart = this.timelineService.parseDate(project.startDate);
        const projectEnd = this.timelineService.parseDate(project.endDate);

        if (!projectStart || !projectEnd) {
            this.timelineColumns.set([]);
            return;
        }

        // Add padding (2 weeks on each side)
        const paddingDays = 14;
        const boundsStart = new Date(projectStart);
        boundsStart.setDate(boundsStart.getDate() - paddingDays);
        const boundsEnd = new Date(projectEnd);
        boundsEnd.setDate(boundsEnd.getDate() + paddingDays);

        const totalDays = Math.ceil((boundsEnd.getTime() - boundsStart.getTime()) / (1000 * 60 * 60 * 24));

        this.timelineBounds.set({
            startDate: boundsStart,
            endDate: boundsEnd,
            totalDays,
            paddingDays
        });

        // Generate grid columns based on time scale
        const columns = this.generateTimelineColumns(boundsStart, boundsEnd);
        this.timelineColumns.set(columns);

        // Calculate today position
        this.calculateTodayPosition();
    }

    /**
     * Generate timeline columns based on time scale
     * Now includes actualDays for accurate width calculation
     */
    generateTimelineColumns(startDate: Date, endDate: Date): TimelineGridCellExtended[] {
        const columns: TimelineGridCellExtended[] = [];
        const scale = this.timeScale();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let currentDate = new Date(startDate);
        let columnId = 0;

        if (scale === TimeScale.WEEK) {
            // Week view: Create weekly columns with daily sub-labels
            while (currentDate <= endDate) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 6);

                // Generate daily labels and track months in this week
                const dailyLabels: string[] = [];
                const monthsInWeek = new Set<number>();

                for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
                    const dayDate = new Date(weekStart);
                    dayDate.setDate(dayDate.getDate() + dayOffset);

                    if (dayDate > endDate) break;

                    const dayNum = dayDate.getDate();
                    dailyLabels.push(`${dayNum}`); // Just the number
                    monthsInWeek.add(dayDate.getMonth());
                }

                // Generate month label for this week
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const monthsArray = Array.from(monthsInWeek).sort();
                const monthLabel = monthsArray.map(m => monthNames[m]).join(' / ');

                const isCurrent = today >= weekStart && today <= weekEnd;

                // Calculate actual days in this week column
                const actualDays = Math.ceil((weekEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                columns.push({
                    id: `week-${columnId++}`,
                    label: dailyLabels.join('|'), // Day numbers separated by |
                    startDate: weekStart,
                    endDate: weekEnd,
                    isCurrent,
                    isToday: isCurrent,
                    actualDays: actualDays,
                    monthLabel: monthLabel // Add month label for week header
                } as any); // Cast to bypass type checking for now

                currentDate.setDate(currentDate.getDate() + 7);
            }
        } else if (scale === TimeScale.MONTH) {
            // Month view: Show full month names
            let previousYear = -1;
            while (currentDate <= endDate) {
                const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

                const isCurrent = today >= monthStart && today <= monthEnd;

                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const currentYear = monthStart.getFullYear();

                // Show year only when it changes
                const label = previousYear !== -1 && previousYear !== currentYear
                    ? `${monthNames[monthStart.getMonth()]} ${currentYear}`
                    : monthNames[monthStart.getMonth()];

                previousYear = currentYear;

                // Calculate actual days in this month
                const actualDays = monthEnd.getDate(); // Last day of month = number of days

                columns.push({
                    id: `month-${columnId++}`,
                    label,
                    startDate: monthStart,
                    endDate: monthEnd,
                    isCurrent,
                    isToday: isCurrent,
                    actualDays: actualDays
                });

                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        } else if (scale === TimeScale.QUARTER) {
            // Quarter view: Show month ranges
            while (currentDate <= endDate) {
                const quarter = Math.floor(currentDate.getMonth() / 3);
                const quarterStart = new Date(currentDate.getFullYear(), quarter * 3, 1);
                const quarterEnd = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);

                const isCurrent = today >= quarterStart && today <= quarterEnd;

                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                const startMonth = monthNames[quarter * 3];
                const endMonth = monthNames[quarter * 3 + 2];
                const label = `${startMonth} - ${endMonth}`;

                // Calculate actual days in this quarter
                const actualDays = Math.ceil((quarterEnd.getTime() - quarterStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                columns.push({
                    id: `quarter-${columnId++}`,
                    label,
                    startDate: quarterStart,
                    endDate: quarterEnd,
                    isCurrent,
                    isToday: isCurrent,
                    actualDays: actualDays
                });

                currentDate.setMonth(currentDate.getMonth() + 3);
            }
        }

        return columns;
    }

    /**
     * Calculate pixel position for today marker
     */
    calculateTodayPosition() {
        const bounds = this.timelineBounds();
        const columns = this.timelineColumns();

        if (!bounds || columns.length === 0) {
            this.todayPosition.set(0);
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (today < bounds.startDate || today > bounds.endDate) {
            this.todayPosition.set(0);
            return;
        }

        const scale = this.timeScale();
        const dayWidth = this.getDayWidth();

        // For WEEK view, use simple day-based positioning and center in day column
        if (scale === TimeScale.WEEK) {
            const daysSinceStart = Math.floor((today.getTime() - bounds.startDate.getTime()) / (1000 * 60 * 60 * 24));
            // Add 0.5 day width to center the marker in the day column
            const position = (daysSinceStart * dayWidth) + (dayWidth / 2);
            this.todayPosition.set(Math.max(0, position));
            return;
        }

        // For MONTH and QUARTER views, use proportional positioning within columns
        const columnWidth = this.getColumnWidth();
        let position = 0;

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const colStart = column.startDate;
            const colEnd = column.endDate;

            if (today >= colStart && today <= colEnd) {
                // Today is in this column - calculate exact position within column
                const colDuration = colEnd.getTime() - colStart.getTime();
                const todayOffset = today.getTime() - colStart.getTime();
                const percentInColumn = todayOffset / colDuration;
                position = (i * columnWidth) + (percentInColumn * columnWidth);
                break;
            } else if (today < colStart) {
                // Today is before this column
                position = i * columnWidth;
                break;
            }
        }

        // If today is after all columns, place at the end
        if (position === 0 && today > columns[columns.length - 1].endDate) {
            position = columns.length * columnWidth;
        }

        this.todayPosition.set(Math.max(0, position));
    }

    /**
     * Get column width based on time scale
     * Returns the total width of a column (week = 7 days, month = full month, quarter = 3 months)
     */
    getColumnWidth(): number {
        const scale = this.timeScale();
        const dayWidth = 40; // Base width for one day

        if (scale === TimeScale.WEEK) {
            // Week column contains 7 days
            return dayWidth * 7; // 490px for a week
        }
        if (scale === TimeScale.MONTH) {
            // Month view: approximate average month length
            return dayWidth * 7; // ~2100px for a month
        }
        if (scale === TimeScale.QUARTER) {
            // Quarter view: 3 months
            return dayWidth * 7; // ~6300px for a quarter
        }
        return dayWidth * 7;
    }

    /**
     * Get the width of a single day cell (used for all calculations)
     */
    getDayWidth(): number {
        return 40; // Must match dayWidth in getColumnWidth()
    }

    /**
     * Get column width by index (uses actualDays for accurate calculation)
     */
    getColumnWidthByIndex(columnIndex: number): number {
        const columns = this.timelineColumns();
        if (columnIndex < 0 || columnIndex >= columns.length) {
            return this.getColumnWidth();
        }
        const column = columns[columnIndex];
        const dayWidth = this.getDayWidth();
        return (column.actualDays || 7) * dayWidth;
    }

    /**
     * Calculate bar position and width based on precise date alignment
     * Uses uniform column widths with proportional date-based positioning
     */
    calculateBarPosition(startDate: string | undefined, endDate: string | undefined): { left: number; width: number } {
        if (!startDate || !endDate) {
            return { left: 0, width: 0 };
        }

        const bounds = this.timelineBounds();
        const columns = this.timelineColumns();
        if (!bounds || columns.length === 0) {
            return { left: 0, width: 0 };
        }

        const barStart = this.timelineService.parseDate(startDate);
        const barEnd = this.timelineService.parseDate(endDate);

        if (!barStart || !barEnd) {
            return { left: 0, width: 0 };
        }

        const dayWidth = this.getDayWidth();
        const scale = this.timeScale();

        // For WEEK view, use simple day-based positioning for exact alignment
        if (scale === TimeScale.WEEK) {
            // Calculate days from timeline start
            const startDays = Math.floor((barStart.getTime() - bounds.startDate.getTime()) / (1000 * 60 * 60 * 24));
            const endDays = Math.floor((barEnd.getTime() - bounds.startDate.getTime()) / (1000 * 60 * 60 * 24));

            // Position based on exact day offsets
            const left = startDays * dayWidth;
            // Width includes the end day (+1 to extend through end date)
            const width = Math.max((endDays - startDays + 1) * dayWidth, dayWidth);

            return { left: Math.max(0, left), width };
        }

        // For MONTH and QUARTER views, use proportional positioning within columns
        const columnWidth = this.getColumnWidth(); 

        // Calculate position by finding which column the bar spans
        let left = 0;
        let width = 0;
        let cumulativeLeft = 0;

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const colStart = column.startDate;
            const colEnd = column.endDate;

            // Check if bar starts in this column
            if (barStart >= colStart && barStart <= colEnd) {
                // Calculate proportional offset within this column
                const colDuration = colEnd.getTime() - colStart.getTime();
                const offsetFromColStart = barStart.getTime() - colStart.getTime();
                const percentIntoColumn = colDuration > 0 ? offsetFromColStart / colDuration : 0;
                left = cumulativeLeft + (percentIntoColumn * columnWidth);
            }

            // Calculate width by checking where bar ends
            if (barEnd >= colStart && barEnd <= colEnd) {
                // Bar ends in this column
                // Add 1 day to end date to represent end of that day
                const barEndPlusOne = new Date(barEnd);
                barEndPlusOne.setDate(barEndPlusOne.getDate() + 1);

                const colDuration = colEnd.getTime() - colStart.getTime();
                const offsetFromColStart = barEndPlusOne.getTime() - colStart.getTime();
                const percentIntoColumn = colDuration > 0 ? offsetFromColStart / colDuration : 1;
                const endPosition = cumulativeLeft + (percentIntoColumn * columnWidth);
                width = endPosition - left;
                break;
            } else if (barStart <= colEnd && barEnd > colEnd) {
                // Bar spans through this column
                if (barStart >= colStart) {
                    // Bar started in this column, add remaining width
                    const colDuration = colEnd.getTime() - colStart.getTime();
                    const offsetFromColStart = barStart.getTime() - colStart.getTime();
                    const percentIntoColumn = colDuration > 0 ? offsetFromColStart / colDuration : 0;
                    width += columnWidth - (percentIntoColumn * columnWidth);
                } else if (barStart < colStart) {
                    // Bar started before this column, add full column width
                    width += columnWidth;
                }
            }

            cumulativeLeft += columnWidth;
        }

        // Ensure minimum width of one day
        width = Math.max(width, dayWidth);

        return { left: Math.max(0, left), width };
    }

    /**
     * Time scale selector methods
     */
    setTimeScale(scale: TimeScale) {
        this.timeScale.set(scale);
        this.calculateTimeline(this.phases());
        // Don't auto-scroll - only scroll to today on initial load or when user clicks button
    }

    scrollToToday(smooth: boolean = true) {
        const position = this.todayPosition();
        if (position > 0) {
            // Use the correct selector for the scrollable element
            const timelineBody = document.querySelector('.timeline-body-inner');
            const horizontalScrollbar = document.querySelector('.timeline-horizontal-scroll');

            if (timelineBody && horizontalScrollbar) {
                // Calculate scroll position to center today's marker
                const viewportWidth = (timelineBody as HTMLElement).clientWidth;
                const scrollPosition = Math.max(0, position - (viewportWidth / 2));

                if (smooth) {
                    // Smooth scroll both elements
                    (timelineBody as HTMLElement).scrollTo({
                        left: scrollPosition,
                        behavior: 'smooth'
                    });
                    (horizontalScrollbar as HTMLElement).scrollTo({
                        left: scrollPosition,
                        behavior: 'smooth'
                    });
                } else {
                    // Instant scroll (for view changes)
                    (timelineBody as HTMLElement).scrollLeft = scrollPosition;
                    (horizontalScrollbar as HTMLElement).scrollLeft = scrollPosition;
                }
            }
        }
    }

    /**
     * Phase expansion toggle
     */
    togglePhaseExpansion(phaseId: number) {
        const expanded = new Set(this.expandedPhases());
        if (expanded.has(phaseId)) {
            expanded.delete(phaseId);
        } else {
            expanded.add(phaseId);
        }
        this.expandedPhases.set(expanded);
    }

    isPhaseExpanded(phaseId: number): boolean {
        return this.expandedPhases().has(phaseId);
    }


    //Drag and resize handlers  
    onBarDragStart(event: MouseEvent, row: TimelineRow) {
        if ((event.target as HTMLElement).classList.contains('cursor-ew-resize')) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (!row.startDate || !row.endDate) return;

        // Get initial Y position from bar element
        const barElement = (event.target as HTMLElement).closest('.timeline-bar') as HTMLElement;
        const barRect = barElement?.getBoundingClientRect();
        const initialY = barRect ? barRect.top + (barRect.height / 2) : event.clientY;

        this.dragState.set({
            barId: `${row.type}-${row.type === 'task' ? row.taskId : row.phaseId}`,
            type: 'move',
            startX: event.clientX,
            originalStartDate: row.startDate,
            originalEndDate: row.endDate,
            initialTooltipY: initialY
        });
    }

    onBarResizeStart(event: MouseEvent, row: TimelineRow, direction: 'left' | 'right') {
        event.preventDefault();
        event.stopPropagation();

        // Get initial Y position from bar element
        const barElement = (event.target as HTMLElement).closest('.timeline-bar') as HTMLElement;
        const barRect = barElement?.getBoundingClientRect();
        const initialY = barRect ? barRect.top + (barRect.height / 2) : event.clientY;

        this.dragState.set({
            type: `resize-${direction}`,
            barId: `${row.type}-${row.type === 'task' ? row.taskId : row.phaseId}`,
            startX: event.clientX,
            originalStartDate: row.startDate || '',
            originalEndDate: row.endDate || '',
            initialTooltipY: initialY // Store initial Y position
        });
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        const drag = this.dragState();
        if (!drag) {
            // Clear live resize state if drag ended
            if (this.liveResizeState()) {
                this.liveResizeState.set(null);
            }
            return;
        }

        event.preventDefault();

        const deltaX = event.clientX - drag.startX;
        const dayWidth = this.getDayWidth();
        const deltaDays = Math.round(deltaX / dayWidth);

        const bounds = this.timelineBounds();
        if (!bounds) return;

        const originalStart = this.timelineService.parseDate(drag.originalStartDate);
        const originalEnd = this.timelineService.parseDate(drag.originalEndDate);
        if (!originalStart || !originalEnd) return;

        // Calculate original duration in days
        const originalDuration = Math.ceil((originalEnd.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate new dates based on drag type
        let newStart: Date, newEnd: Date;
        if (drag.type === 'move') {
            // Move: shift both dates by same amount, keep duration
            newStart = new Date(originalStart);
            newStart.setDate(newStart.getDate() + deltaDays);
            newEnd = new Date(originalEnd);
            newEnd.setDate(newEnd.getDate() + deltaDays);
        } else if (drag.type === 'resize-left') {
            // Resize left: adjust start only
            newStart = new Date(originalStart);
            newStart.setDate(newStart.getDate() + deltaDays);
            newEnd = originalEnd;
            // Ensure minimum 1 day
            if (newStart >= newEnd) {
                newStart = new Date(newEnd);
                newStart.setDate(newStart.getDate() - 1);
            }
        } else {
            // Resize right: adjust end only
            newStart = originalStart;
            newEnd = new Date(originalEnd);
            newEnd.setDate(newEnd.getDate() + deltaDays);
            // Ensure minimum 1 day
            if (newEnd <= newStart) {
                newEnd = new Date(newStart);
                newEnd.setDate(newEnd.getDate() + 1);
            }
        }

        // Calculate visual position
        const newStartStr = this.timelineService.formatDateForAPI(newStart);
        const newEndStr = this.timelineService.formatDateForAPI(newEnd);
        const newPosition = this.calculateBarPosition(newStartStr, newEndStr);

        // Update live resize state
        this.liveResizeState.set({
            barId: drag.barId,
            left: newPosition.left,
            width: newPosition.width,
            startDate: newStartStr,
            endDate: newEndStr
        });

        // Update tooltip at bar's position (fixed Y, horizontal with bar)
        // Convert bar position (container-relative) to viewport coordinates
        const timelineBody = document.querySelector('.timeline-body-content') as HTMLElement;
        let tooltipX = 0;

        if (timelineBody) {
            const containerRect = timelineBody.getBoundingClientRect();
            const scrollLeft = timelineBody.querySelector('.timeline-body-inner')?.scrollLeft || 0;
            // Bar position is relative to scrolled content, convert to viewport
            tooltipX = containerRect.left + (newPosition.left + (newPosition.width / 2)) - scrollLeft;
        } else {
            // Fallback to just using bar center
            tooltipX = newPosition.left + (newPosition.width / 2);
        }

        const barY = drag.initialTooltipY || event.clientY;
        const showAbove = (window.innerHeight - barY) < 100;

        if (drag.barId.startsWith('phase-')) {
            const phaseId = parseInt(drag.barId.replace('phase-', ''));
            const phase = this.phases().find(p => p.phaseId === phaseId);
            if (phase) {
                this.hoveredPhase.set({
                    phase: { ...phase, startDate: newStartStr, endDate: newEndStr },
                    index: 0,
                    x: tooltipX,
                    y: barY,
                    showAbove
                });
            }
        } else if (drag.barId.startsWith('task-')) {
            const taskId = parseInt(drag.barId.replace('task-', ''));
            let task: any = null;
            for (const phase of this.phases()) {
                task = phase.tasks?.find(t => t.taskId === taskId);
                if (task) break;
            }
            if (task) {
                this.hoveredTask.set({
                    task: { ...task, startDate: newStartStr, endDate: newEndStr },
                    x: tooltipX,
                    y: barY,
                    showAbove
                });
            }
        }
    }

    @HostListener('document:mouseup', ['$event'])
    onMouseUp(event: MouseEvent) {
        const drag = this.dragState();
        if (!drag) return;

        event.stopPropagation();
        event.preventDefault();

        const deltaX = event.clientX - drag.startX;
        const bounds = this.timelineBounds();
        if (!bounds) {
            // Always clear states even if bounds missing
            this.dragState.set(null);
            this.liveResizeState.set(null);
            this.hoveredPhase.set(null);
            this.hoveredTask.set(null);
            return;
        }

        // Calculate delta in days
        const dayWidth = this.getDayWidth();
        const deltaDays = Math.round(deltaX / dayWidth);

        const originalStart = this.timelineService.parseDate(drag.originalStartDate);
        const originalEnd = this.timelineService.parseDate(drag.originalEndDate);

        if (!originalStart || !originalEnd) {
            // Always clear states even if parsing failed
            this.dragState.set(null);
            this.liveResizeState.set(null);
            this.hoveredPhase.set(null);
            this.hoveredTask.set(null);
            return;
        }

        let newStart: Date;
        let newEnd: Date;

        if (drag.type === 'move') {
            newStart = new Date(originalStart);
            newStart.setDate(newStart.getDate() + deltaDays);
            newEnd = new Date(originalEnd);
            newEnd.setDate(newEnd.getDate() + deltaDays);
        } else if (drag.type === 'resize-left') {
            newStart = new Date(originalStart);
            newStart.setDate(newStart.getDate() + deltaDays);
            newEnd = originalEnd;
            if (newStart >= newEnd) {
                newStart = new Date(newEnd);
                newStart.setDate(newStart.getDate() - 1);
            }
        } else {
            newStart = originalStart;
            newEnd = new Date(originalEnd);
            newEnd.setDate(newEnd.getDate() + deltaDays);
            if (newEnd <= newStart) {
                newEnd = new Date(newStart);
                newEnd.setDate(newEnd.getDate() + 1);
            }
        }

        // Update the phase or task dates
        this.updateBarDates(drag.barId, newStart, newEnd);

        // Always clear drag state, live resize state, and tooltips
        this.dragState.set(null);
        this.liveResizeState.set(null);
        this.hoveredPhase.set(null);
        this.hoveredTask.set(null);
    }


    //Update bar dates after drag/resize
    updateBarDates(barId: string, newStart: Date, newEnd: Date) {
        const phasesData = [...this.phases()];
        let updated = false;

        const newStartStr = this.timelineService.formatDateForAPI(newStart);
        const newEndStr = this.timelineService.formatDateForAPI(newEnd);

        const project = this.selectedProject();
        if (!project) return;

        if (barId.startsWith('phase-')) {
            const phaseId = parseInt(barId.replace('phase-', ''));
            const phaseIndex = phasesData.findIndex(p => p.phaseId === phaseId);
            if (phaseIndex !== -1) {
                phasesData[phaseIndex] = {
                    ...phasesData[phaseIndex],
                    startDate: newStartStr,
                    endDate: newEndStr
                };
                updated = true;

                // Call backend API to persist changes
                this.timelineService.updatePhaseDates(project.projectId, phaseId, newStartStr, newEndStr).subscribe({
                    next: () => {
                        console.log('Phase dates updated successfully:', phaseId, newStartStr, newEndStr);
                    },
                    error: (err: any) => {
                        console.error('Error updating phase dates:', err);
                        this.errorMessage.set('Failed to update phase dates. Please try again.');
                        // Revert local changes on error
                        this.loadPhases(project.projectId);
                    }
                });
            }
        } else if (barId.startsWith('task-')) {
            const taskId = parseInt(barId.replace('task-', ''));
            for (let i = 0; i < phasesData.length; i++) {
                const taskIndex = phasesData[i].tasks?.findIndex(t => t.taskId === taskId);
                if (taskIndex !== undefined && taskIndex !== -1 && phasesData[i].phaseId) {
                    const updatedTasks = [...(phasesData[i].tasks || [])];
                    updatedTasks[taskIndex] = {
                        ...updatedTasks[taskIndex],
                        startDate: newStartStr,
                        endDate: newEndStr
                    };
                    phasesData[i] = {
                        ...phasesData[i],
                        tasks: updatedTasks
                    };
                    updated = true;

                    // Call backend API to persist changes
                    this.timelineService.updateTaskDates(
                        project.projectId,
                        phasesData[i].phaseId!,
                        taskId,
                        newStartStr,
                        newEndStr
                    ).subscribe({
                        next: () => {
                            console.log('Task dates updated successfully:', taskId, newStartStr, newEndStr);
                        },
                        error: (err: any) => {
                            console.error('Error updating task dates:', err);
                            this.errorMessage.set('Failed to update task dates. Please try again.');
                            // Revert local changes on error
                            this.loadPhases(project.projectId);
                        }
                    });
                    break;
                }
            }
        }

        if (updated) {
            this.phases.set(phasesData);
        }
    }




    //Get status color class
    getStatusClass(status?: string): string {
        switch (status) {
            case 'DONE': return 'bg-green-500';
            case 'IN_PROGRESS': return 'bg-blue-500';
            case 'REVIEW': return 'bg-yellow-500';
            case 'TO_DO': return 'bg-gray-400';
            default: return 'bg-gray-400';
        }
    }


    //Get phase color based on index
    getPhaseColor(index: number): string {
        const colors = [
            'bg-[#8c2d1b]',
            'bg-emerald-600',
            'bg-purple-600',
            'bg-amber-600',
            'bg-pink-600',
            'bg-indigo-600',
            'bg-teal-600',
            'bg-orange-600'
        ];
        return colors[index % colors.length];
    }

    /**
     * Format date for display
     */
    formatDate(dateString: string | undefined): string {
        return this.timelineService.formatDateShort(dateString);
    }

    formatDateFull(dateString: string | undefined): string {
        return this.timelineService.formatDateForDisplay(dateString);
    }


    getTotalTimelineHeight(): number {
        let totalHeight = 0;
        const phasesData = this.phases();
        const expanded = this.expandedPhases();

        for (const phase of phasesData) {
            totalHeight += 64; // Phase row height
            // Only count task rows if the phase is expanded
            if (phase.tasks && phase.tasks.length > 0 && phase.phaseId && expanded.has(phase.phaseId)) {
                totalHeight += phase.tasks.length * 48; // Task row height
            }
        }

        // Ensure minimum height to fill viewport (approximately)
        // This ensures grid lines extend to fill empty space
        const minHeight = 600; // Minimum height for grid display
        return Math.max(totalHeight, minHeight);
    }


    //Create a TimelineRow object from phase or task data
    //Helper method for event handlers 
    createTimelineRow(item: Phase | Task, type: 'phase' | 'task', phaseId?: number): TimelineRow {
        if (type === 'phase') {
            const phase = item as Phase;
            const phaseWithTasks = this.phases().find(p => p.phaseId === phase.phaseId);
            const position = this.calculateBarPosition(phase.startDate, phase.endDate);

            return {
                id: `phase-${phase.phaseId}`,
                type: 'phase',
                phaseId: phase.phaseId,
                name: phase.phaseName || '',
                startDate: phase.startDate,
                endDate: phase.endDate,
                completedAt: phase.completedAt,
                progress: phaseWithTasks?.completionPercentage || 0,
                status: phase.status,
                level: 0
            };
        } else {
            const task = item as Task;
            const position = this.calculateBarPosition(task.startDate, task.endDate);

            return {
                id: `task-${task.taskId}`,
                type: 'task',
                phaseId: phaseId,
                taskId: task.taskId,
                name: task.taskName || '',
                startDate: task.startDate,
                endDate: task.endDate,
                completedAt: task.completedAt,
                assignedToName: task.assignedToName,
                status: task.status,
                level: 1
            };
        }
    }


    //Handle mouse wheel event for horizontal scrolling with Shift key
    onTimelineWheel(event: WheelEvent) {
        if (event.shiftKey && this.horizontalScrollbarRef) {
            event.preventDefault();
            const scrollbar = this.horizontalScrollbarRef.nativeElement;
            scrollbar.scrollLeft += event.deltaY;
        }
    }

    /**
     * Tooltip handlers for phases
     */
    onPhaseMouseEnter(event: MouseEvent, phase: PhaseWithTasks, phaseIndex: number) {
        const barRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Use cursor X position
        let x = event.clientX;

        // Estimate tooltip width (adjust based on content)
        const tooltipWidth = 250; // Approximate width

        // Get the timeline container bounds (the chart area)
        const timelineContainer = document.querySelector('.timeline-body-content');
        if (timelineContainer) {
            const containerRect = timelineContainer.getBoundingClientRect();

            // Ensure tooltip doesn't overflow left edge
            if (x - tooltipWidth / 2 < containerRect.left) {
                x = containerRect.left + tooltipWidth / 2 + 10;
            }

            // Ensure tooltip doesn't overflow right edge
            if (x + tooltipWidth / 2 > containerRect.right) {
                x = containerRect.right - tooltipWidth / 2 - 10;
            }
        }

        // Calculate if tooltip should show above or below based on bar position
        const spaceBelow = viewportHeight - barRect.bottom;
        const showAbove = spaceBelow < 100;

        const y = showAbove ? barRect.top : barRect.bottom;

        this.hoveredPhase.set({
            phase,
            index: phaseIndex,
            x,
            y,
            showAbove
        });
    }

    onPhaseMouseLeave() {
        this.hoveredPhase.set(null);
    }

    /**
     * Tooltip handlers for tasks  
     */
    onTaskMouseEnter(event: MouseEvent, task: Task) {
        const barRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Use cursor X position
        let x = event.clientX;

        // Estimate tooltip width (adjust based on content)
        const tooltipWidth = 250; // Approximate width

        // Get the timeline container bounds (the chart area)
        const timelineContainer = document.querySelector('.timeline-body-content');
        if (timelineContainer) {
            const containerRect = timelineContainer.getBoundingClientRect();

            // Ensure tooltip doesn't overflow left edge
            if (x - tooltipWidth / 2 < containerRect.left) {
                x = containerRect.left + tooltipWidth / 2 + 10;
            }

            // Ensure tooltip doesn't overflow right edge
            if (x + tooltipWidth / 2 > containerRect.right) {
                x = containerRect.right - tooltipWidth / 2 - 10;
            }
        }

        // Calculate if tooltip should show above or below based on bar position
        const spaceBelow = viewportHeight - barRect.bottom;
        const showAbove = spaceBelow < 100;

        const y = showAbove ? barRect.top : barRect.bottom;

        this.hoveredTask.set({
            task,
            x,
            y,
            showAbove
        });
    }

    onTaskMouseLeave() {
        this.hoveredTask.set(null);
    }
}
