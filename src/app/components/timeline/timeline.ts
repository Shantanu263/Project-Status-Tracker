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
    timelineColumns = signal<TimelineGridCell[]>([]);
    timelineBounds = signal<TimelineBounds | null>(null);

    // UI state
    expandedPhases = signal<Set<number>>(new Set());
    dragState = signal<DragState | null>(null);
    todayPosition = signal<number>(0);

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
     */
    generateTimelineColumns(startDate: Date, endDate: Date): TimelineGridCell[] {
        const columns: TimelineGridCell[] = [];
        const scale = this.timeScale();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let currentDate = new Date(startDate);
        let columnId = 0;

        if (scale === TimeScale.WEEK) {
            // Weekly columns
            while (currentDate <= endDate) {
                const weekStart = new Date(currentDate);
                const weekEnd = new Date(currentDate);
                weekEnd.setDate(weekEnd.getDate() + 6);

                const isCurrent = today >= weekStart && today <= weekEnd;

                columns.push({
                    id: `week-${columnId++}`,
                    label: `Week ${columnId}`,
                    startDate: weekStart,
                    endDate: weekEnd,
                    isCurrent,
                    isToday: isCurrent
                });

                currentDate.setDate(currentDate.getDate() + 7);
            }
        } else if (scale === TimeScale.MONTH) {
            // Monthly columns
            while (currentDate <= endDate) {
                const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

                const isCurrent = today >= monthStart && today <= monthEnd;

                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const label = `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;

                columns.push({
                    id: `month-${columnId++}`,
                    label,
                    startDate: monthStart,
                    endDate: monthEnd,
                    isCurrent,
                    isToday: isCurrent
                });

                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        } else if (scale === TimeScale.QUARTER) {
            // Quarterly columns
            while (currentDate <= endDate) {
                const quarter = Math.floor(currentDate.getMonth() / 3);
                const quarterStart = new Date(currentDate.getFullYear(), quarter * 3, 1);
                const quarterEnd = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);

                const isCurrent = today >= quarterStart && today <= quarterEnd;

                const label = `Q${quarter + 1} ${quarterStart.getFullYear()}`;

                columns.push({
                    id: `quarter-${columnId++}`,
                    label,
                    startDate: quarterStart,
                    endDate: quarterEnd,
                    isCurrent,
                    isToday: isCurrent
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

        // More accurate calculation: find which column today falls into
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
     */
    getColumnWidth(): number {
        const scale = this.timeScale();
        if (scale === TimeScale.WEEK) return 128; // 32rem
        if (scale === TimeScale.MONTH) return 160; // 40rem
        if (scale === TimeScale.QUARTER) return 200; // 50rem
        return 128;
    }

    /**
     * Calculate bar position and width
     */
    calculateBarPosition(startDate: string | undefined, endDate: string | undefined): { left: number; width: number } {
        if (!startDate || !endDate) {
            return { left: 0, width: 0 };
        }

        const bounds = this.timelineBounds();
        if (!bounds) {
            return { left: 0, width: 0 };
        }

        const barStart = this.timelineService.parseDate(startDate);
        const barEnd = this.timelineService.parseDate(endDate);

        if (!barStart || !barEnd) {
            return { left: 0, width: 0 };
        }

        const startDays = Math.ceil((barStart.getTime() - bounds.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const durationDays = Math.ceil((barEnd.getTime() - barStart.getTime()) / (1000 * 60 * 60 * 24));

        const columnWidth = this.getColumnWidth();
        const totalWidth = this.timelineColumns().length * columnWidth;

        const left = (startDays / bounds.totalDays) * totalWidth;
        const width = (durationDays / bounds.totalDays) * totalWidth;

        return { left: Math.max(0, left), width: Math.max(20, width) };
    }

    /**
     * Time scale selector methods
     */
    setTimeScale(scale: TimeScale) {
        this.timeScale.set(scale);
        this.calculateTimeline(this.phases());
        // Auto-center on today after view change (instant, no animation)
        setTimeout(() => {
            this.scrollToToday(false);
        }, 100);
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
        event.preventDefault();
        event.stopPropagation();

        if (!row.startDate || !row.endDate) return;

        const position = this.calculateBarPosition(row.startDate, row.endDate);

        this.dragState.set({
            barId: row.id,
            type: 'move',
            startX: event.clientX,
            startLeft: position.left,
            startWidth: position.width,
            originalStartDate: row.startDate,
            originalEndDate: row.endDate
        });
    }

    onBarResizeStart(event: MouseEvent, row: TimelineRow, handle: 'left' | 'right') {
        event.preventDefault();
        event.stopPropagation();

        if (!row.startDate || !row.endDate) return;

        const position = this.calculateBarPosition(row.startDate, row.endDate);

        this.dragState.set({
            barId: row.id,
            type: handle === 'left' ? 'resize-left' : 'resize-right',
            startX: event.clientX,
            startLeft: position.left,
            startWidth: position.width,
            originalStartDate: row.startDate,
            originalEndDate: row.endDate
        });
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
        const drag = this.dragState();
        if (!drag) return;

        const deltaX = event.clientX - drag.startX;
    }

    @HostListener('document:mouseup', ['$event'])
    onMouseUp(event: MouseEvent) {
        const drag = this.dragState();
        if (!drag) return;

        const deltaX = event.clientX - drag.startX;
        const bounds = this.timelineBounds();
        if (!bounds) {
            this.dragState.set(null);
            return;
        }

        const columnWidth = this.getColumnWidth();
        const totalWidth = this.timelineColumns().length * columnWidth;
        const deltaDays = Math.round((deltaX / totalWidth) * bounds.totalDays);

        const originalStart = this.timelineService.parseDate(drag.originalStartDate);
        const originalEnd = this.timelineService.parseDate(drag.originalEndDate);

        if (!originalStart || !originalEnd) {
            this.dragState.set(null);
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
        } else {
            newStart = originalStart;
            newEnd = new Date(originalEnd);
            newEnd.setDate(newEnd.getDate() + deltaDays);
        }

        // Update the phase or task dates
        this.updateBarDates(drag.barId, newStart, newEnd);

        this.dragState.set(null);
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

        return totalHeight;
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
}
