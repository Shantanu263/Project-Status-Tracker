import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, AfterViewInit, ViewChild, ElementRef, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportTimelineModalComponent } from './export-timeline-modal/export-timeline-modal';
import { TimelineService } from '../../services/timeline.service';
import { ProjectService } from '../../services/project.service';
import { SelectedProjectService } from '../../services/selected-project.service';
import { Phase, Task } from '../../models/phase.model';
import { DataSyncService } from '../../services/data-sync.service';
import { PermissionService } from '../../services/permission.service';
import { AuthService } from '../../services/auth.service';
import { ProjectMember } from '../../models/project.model';
import {
    TimeScale,
    TimelineGridCell,
    TimelineBar,
    TimelineRow,
    DragState,
    TimelineBounds,
    PhaseDependency
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
    imports: [CommonModule, FormsModule, ExportTimelineModalComponent],
    templateUrl: './timeline.html',
    styleUrl: './timeline.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimelineComponent implements OnInit, AfterViewInit {
    private timelineService = inject(TimelineService);
    private projectService = inject(ProjectService);
    private selectedProjectService = inject(SelectedProjectService);
    private readonly dataSyncService = inject(DataSyncService);
    private readonly permissionService = inject(PermissionService);
    private readonly authService = inject(AuthService);

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

    // Sort state
    sortOption = signal<'id' | 'name' | 'startDate' | 'endDate'>('id');
    sortDirection = signal<'asc' | 'desc'>('asc');
    isSortMenuOpen = signal<boolean>(false);

    // Export modal state
    showExportModal = signal<boolean>(false);
    showExportMenu = signal<boolean>(false);

    // Loading and error states
    isLoading = signal<boolean>(false);
    errorMessage = signal<string>('');

    // ===== Dependency linking state =====
    dependencies = signal<PhaseDependency[]>([]);
    isLinkMode = signal(false);
    linkPredecessorId = signal<number | null>(null);
    previewLineEnd = signal<{ x: number; y: number } | null>(null);
    showDependencyTypePopup = signal<{ predecessorId: number; successorId: number; x: number; y: number } | null>(null);
    toastMessage = signal<string | null>(null);
    selectedDependencyId = signal<number | null>(null);
    private toastTimeout: ReturnType<typeof setTimeout> | null = null;

    // Project members for permission checks
    projectMembers = signal<ProjectMember[]>([]);

    // Permission computed signals
    canUpdatePhaseTimeline = computed(() => {
        const currentUserId = this.authService.getCurrentUserId();
        return this.permissionService.canUpdatePhaseTimeline(this.projectMembers(), currentUserId);
    });

    canUpdateTaskTimeline = computed(() => {
        const currentUserId = this.authService.getCurrentUserId();
        return this.permissionService.canUpdateTaskTimeline(this.projectMembers(), currentUserId);
    });

    // Sorted phases computed
    sortedPhases = computed(() => {
        const option = this.sortOption();
        const direction = this.sortDirection();
        const data = this.phases();

        // Clone to avoid mutating original source data
        const phasesCopy = data.map(p => ({
            ...p,
            tasks: [...(p.tasks || [])]
        }));

        const compare = (a: any, b: any, sortTarget: string) => {
            let result = 0;
            switch (sortTarget) {
                case 'name':
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const nameA = a.phaseName || a.taskName || '';
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const nameB = b.phaseName || b.taskName || '';
                    result = nameA.localeCompare(nameB);
                    break;
                case 'startDate': {
                    const dateA = this.timelineService.parseDate(a.startDate);
                    const dateB = this.timelineService.parseDate(b.startDate);
                    const timeA = dateA ? dateA.getTime() : 0;
                    const timeB = dateB ? dateB.getTime() : 0;
                    result = timeA - timeB;
                    break;
                }
                case 'endDate': {
                    const dateA = this.timelineService.parseDate(a.endDate);
                    const dateB = this.timelineService.parseDate(b.endDate);
                    const timeA = dateA ? dateA.getTime() : 0;
                    const timeB = dateB ? dateB.getTime() : 0;
                    result = timeA - timeB;
                    break;
                }
                case 'id':
                default:
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const idA = a.phaseId !== undefined ? a.phaseId : (a.taskId !== undefined ? a.taskId : 0);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const idB = b.phaseId !== undefined ? b.phaseId : (b.taskId !== undefined ? b.taskId : 0);
                    result = idA - idB;
                    break;
            }
            return direction === 'asc' ? result : -result;
        };

        // Sort both phases and internal tasks
        phasesCopy.sort((a, b) => compare(a, b, option));
        phasesCopy.forEach(phase => {
            phase.tasks.sort((a, b) => compare(a, b, option));
        });

        return phasesCopy;
    });

    // Computed values
    timelineRows = computed(() => {
        const rows: TimelineRow[] = [];
        const phasesData = this.sortedPhases();
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
                completedOn: phase.completedOn,
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
                        completedOn: task.completedOn,
                        assignedToName: task.assignedToName,
                        status: task.status,
                        level: 1
                    });
                });
            }
        });

        return rows;
    });

    // Computed dependency lines for SVG rendering
    dependencyLines = computed(() => {
        const deps = this.dependencies();
        const phasesData = this.sortedPhases();
        const columns = this.timelineColumns();
        // Access signals to re-trigger on zoom/expand changes
        this.timeScale();
        this.expandedPhases();

        if (deps.length === 0 || phasesData.length === 0 || columns.length === 0) return [];

        return deps.map(dep => {
            const predPhase = phasesData.find(p => p.phaseId === dep.predecessorId);
            const succPhase = phasesData.find(p => p.phaseId === dep.successorId);

            if (!predPhase || !succPhase) return null;

            const predBar = this.calculateBarPosition(predPhase.startDate, predPhase.endDate);
            const succBar = this.calculateBarPosition(succPhase.startDate, succPhase.endDate);

            const predY = this.getPhaseRowCenterY(dep.predecessorId);
            const succY = this.getPhaseRowCenterY(dep.successorId);

            if (predY === null || succY === null) return null;

            // 8px bar padding offset applied in template
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
                    const ssMidX = Math.min(predLeft, succLeft) - margin;
                    points = [
                        { x: predLeft, y: predY },
                        { x: ssMidX, y: predY },
                        { x: ssMidX, y: succY },
                        { x: succLeft, y: succY }
                    ];
                    labelX = ssMidX;
                    labelY = yMid;
                    break;
                case 'FF':
                    const ffMidX = Math.max(predRight, succRight) + margin;
                    points = [
                        { x: predRight, y: predY },
                        { x: ffMidX, y: predY },
                        { x: ffMidX, y: succY },
                        { x: succRight, y: succY }
                    ];
                    labelX = ffMidX;
                    labelY = yMid;
                    break;
                case 'SF':
                    if (predLeft - margin > succRight + margin) {
                        const midX = predLeft - margin;
                        points = [
                            { x: predLeft, y: predY },
                            { x: midX, y: predY },
                            { x: midX, y: succY },
                            { x: succRight, y: succY }
                        ];
                        labelX = midX;
                        labelY = yMid;
                    } else {
                        const midX1 = predLeft - margin;
                        const midX2 = succRight + margin;
                        points = [
                            { x: predLeft, y: predY },
                            { x: midX1, y: predY },
                            { x: midX1, y: yMid },
                            { x: midX2, y: yMid },
                            { x: midX2, y: succY },
                            { x: succRight, y: succY }
                        ];
                        labelX = midX1 + (midX2 - midX1) / 2;
                        labelY = yMid - 6;
                    }
                    break;
            }

            // Generate clean path with rounded corners
            const generateRoundedPath = (pts: { x: number; y: number }[], r: number) => {
                let d = `M ${pts[0].x} ${pts[0].y}`;
                for (let i = 1; i < pts.length - 1; i++) {
                    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
                    const dx1 = p1.x - p0.x, dy1 = p1.y - p0.y;
                    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
                    const dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
                    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                    const currentR = Math.min(r, len1 / 2, len2 / 2);

                    if (currentR <= 0.1 || (dx1 === 0 && dx2 === 0) || (dy1 === 0 && dy2 === 0)) {
                        d += ` L ${p1.x} ${p1.y}`;
                        continue;
                    }

                    const cp1x = p1.x - (dx1 / len1) * currentR;
                    const cp1y = p1.y - (dy1 / len1) * currentR;
                    const cp2x = p1.x + (dx2 / len2) * currentR;
                    const cp2y = p1.y + (dy2 / len2) * currentR;

                    d += ` L ${cp1x} ${cp1y} Q ${p1.x} ${p1.y} ${cp2x} ${cp2y}`;
                }
                d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
                return d;
            };

            const path = generateRoundedPath(points, 8);

            return {
                dep,
                path,
                labelX,
                labelY,
                endX: points[points.length - 1].x,
                endY: points[points.length - 1].y
            };
        }).filter(Boolean) as { dep: PhaseDependency; path: string; labelX: number; labelY: number; endX: number; endY: number }[];
    });

    private todayCentered = false;

    constructor() {
        // Reload when project changes
        effect(() => {
            const project = this.selectedProject();
            if (project?.projectId) {
                this.todayCentered = false;
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
                    if (!this.todayCentered) {
                        this.scrollToToday();
                        this.todayCentered = true;
                    }
                }, 150);
            }
        });
    }

    ngOnInit() {
        // ... existing logic ...
        const project = this.selectedProject();
        if (project?.projectId) {
            this.loadPhases(project.projectId);
        }

        this.dataSyncService.phasesUpdated$.subscribe(projectId => {
            if (projectId === this.selectedProject().projectId) {
                this.loadPhases(projectId, true);
            }
        });

        // Subscribe to task updates from other components
        this.dataSyncService.tasksUpdated$.subscribe(({ projectId }) => {
            if (projectId === this.selectedProject().projectId) {
                this.loadPhases(projectId, true);
            }
        });

        // Subscribe to project member updates from other components
        this.dataSyncService.projectMembersUpdated$.subscribe(projectId => {
            const project = this.selectedProject();
            if (project && projectId === project.projectId) {
                // Reload project members
                this.projectService.getProjectMembers(projectId).subscribe({
                    next: (members) => {
                        this.projectMembers.set(members);
                    },
                    error: (err) => {
                        console.error('Error loading project members:', err);
                    }
                });
            }
        });
    }

    ngAfterViewInit() {
        // Scroll sync and auto-centering are handled in the effect
        // after data is loaded, so this is just a placeholder for the lifecycle hook
    }

    toggleSortMenu(event: MouseEvent) {
        event.stopPropagation();
        this.isSortMenuOpen.update(val => !val);
    }

    setSortOption(option: 'id' | 'name' | 'startDate' | 'endDate') {
        this.sortOption.set(option);
        this.isSortMenuOpen.set(false);
    }

    toggleSortDirection() {
        this.sortDirection.update(dir => dir === 'asc' ? 'desc' : 'asc');
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
    loadPhases(projectId: number, silent: boolean = false) {
        if (!silent) {
            this.isLoading.set(true);
        }
        this.errorMessage.set('');

        // Also load dependencies
        this.loadDependencies(projectId);

        // Load project members for permission checks
        this.projectService.getProjectMembers(projectId).subscribe({
            next: (members) => {
                this.projectMembers.set(members);
            },
            error: (err) => {
                console.error('Error loading project members:', err);
            }
        });

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
                                const completedTasks = tasks.filter(t => t.status === 'COMPLETED' || t.completedOn).length;
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

        // Compute the true earliest and latest dates across ALL phases and tasks,
        // not just the project dates. This ensures every bar fits within the grid.
        let earliest = new Date(projectStart);
        let latest = new Date(projectEnd);

        for (const phase of phases) {
            const phaseStart = this.timelineService.parseDate(phase.startDate);
            const phaseEnd = this.timelineService.parseDate(phase.endDate);
            if (phaseStart && phaseStart < earliest) earliest = new Date(phaseStart);
            if (phaseEnd && phaseEnd > latest) latest = new Date(phaseEnd);

            if (phase.tasks) {
                for (const task of phase.tasks) {
                    const taskStart = this.timelineService.parseDate(task.startDate);
                    const taskEnd = this.timelineService.parseDate(task.endDate);
                    if (taskStart && taskStart < earliest) earliest = new Date(taskStart);
                    if (taskEnd && taskEnd > latest) latest = new Date(taskEnd);
                }
            }
        }

        // Add padding (2 weeks on each side)
        const paddingDays = 14;
        const boundsStart = new Date(earliest);
        boundsStart.setDate(boundsStart.getDate() - paddingDays);
        const boundsEnd = new Date(latest);
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

        // For WEEK view, use column-relative day-based positioning
        if (scale === TimeScale.WEEK) {
            const gridOrigin = columns[0].startDate;
            const daysSinceStart = this.diffDays(gridOrigin, today);
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
     * Get the width of a single day cell 
     */
    getDayWidth(): number {
        return 40;
    }

    /**
     * Get column width by index 
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
     * Helper: calculate the number of calendar days between two local-midnight Date objects.
     * Uses year/month/day arithmetic to avoid timezone and DST pitfalls.
     */
    private diffDays(a: Date, b: Date): number {
        // Create UTC dates from local year/month/day to get an exact integer difference
        const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        return Math.round((utcB - utcA) / (1000 * 60 * 60 * 24));
    }

    /**
     * Calculate bar position and width based on precise date alignment.
     * Uses column-relative positioning for all views to ensure bars align
     * exactly with the visible grid columns.
     */
    calculateBarPosition(startDate: string | undefined, endDate: string | undefined): { left: number; width: number } {
        if (!startDate || !endDate) {
            return { left: 0, width: 0 };
        }

        const columns = this.timelineColumns();
        if (columns.length === 0) {
            return { left: 0, width: 0 };
        }

        const barStart = this.timelineService.parseDate(startDate);
        const barEnd = this.timelineService.parseDate(endDate);

        if (!barStart || !barEnd) {
            return { left: 0, width: 0 };
        }

        const dayWidth = this.getDayWidth();
        const scale = this.timeScale();

        // For WEEK view: use the first column's startDate as reference to ensure
        // bars align perfectly with the grid day cells.
        if (scale === TimeScale.WEEK) {
            const gridOrigin = columns[0].startDate;

            // Use calendar day diff to avoid timezone/DST issues
            const startDays = this.diffDays(gridOrigin, barStart);
            const endDays = this.diffDays(gridOrigin, barEnd);

            const left = startDays * dayWidth;
            const width = Math.max((endDays - startDays + 1) * dayWidth, dayWidth);

            return { left: Math.max(0, left), width };
        }

        // For MONTH and QUARTER views: proportional column-based positioning
        const columnWidth = this.getColumnWidth();

        let left = 0;
        let width = 0;
        let cumulativeLeft = 0;
        let foundStart = false;

        for (let i = 0; i < columns.length; i++) {
            const column = columns[i];
            const colStart = column.startDate;
            const colEnd = column.endDate;

            // Calculate proportional position using calendar days (immune to timezone issues)
            const colDays = this.diffDays(colStart, colEnd) + 1; // inclusive

            // Check if bar starts in this column
            if (!foundStart && barStart >= colStart && barStart <= colEnd) {
                const daysIntoCol = this.diffDays(colStart, barStart);
                const percentIntoColumn = colDays > 0 ? daysIntoCol / colDays : 0;
                left = cumulativeLeft + (percentIntoColumn * columnWidth);
                foundStart = true;
            }

            // Check if bar ends in this column
            if (barEnd >= colStart && barEnd <= colEnd) {
                // +1 day to represent end-of-day
                const daysIntoCol = this.diffDays(colStart, barEnd) + 1;
                const percentIntoColumn = colDays > 0 ? daysIntoCol / colDays : 1;
                const endPosition = cumulativeLeft + (percentIntoColumn * columnWidth);
                width = endPosition - left;
                break;
            } else if (foundStart && barEnd > colEnd) {
                // Bar spans through this column entirely
                // (width accumulation handled implicitly by endPosition - left)
            } else if (!foundStart && barStart < colStart && barEnd >= colStart) {
                // Bar started before the first visible column
                left = cumulativeLeft;
                foundStart = true;
            }

            cumulativeLeft += columnWidth;
        }

        // If bar ends after the last column
        if (foundStart && width === 0) {
            width = cumulativeLeft - left;
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
                        this.loadPhases(project.projectId, true);
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
                            this.loadPhases(project.projectId, true);
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




    // Parse dd-mm-yyyy date string (backend format) to a Date object
    parseDateFromBackend(date: string | undefined): Date | null {
        if (!date) return null;
        const parts = date.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
        }
        const d = new Date(date);
        return isNaN(d.getTime()) ? null : d;
    }

    // Format a day count into a compact string like "3d", "1w2d", "2m", "1y3m"
    private formatDurationText(days: number): string {
        if (days === 0) return '0d';
        const abs = Math.abs(days);
        if (abs >= 365) {
            const y = Math.floor(abs / 365);
            const m = Math.floor((abs % 365) / 30);
            return m > 0 ? `${y}y${m}m` : `${y}y`;
        }
        if (abs >= 30) {
            const m = Math.floor(abs / 30);
            const w = Math.floor((abs % 30) / 7);
            return w > 0 ? `${m}m${w}w` : `${m}m`;
        }
        if (abs >= 7) {
            const w = Math.floor(abs / 7);
            const d = abs % 7;
            return d > 0 ? `${w}w${d}d` : `${w}w`;
        }
        return `${abs}d`;
    }

    /**
     * Get completion status label and CSS colour class for a phase or task row.
     * Mirrors the getDelayInfo logic from the tasks component.
     * For COMPLETED items: early / on-time / late.
     * For active items: overdue (past end date) or on-track.
     */
    getCompletionStatus(item: { status?: string; endDate?: string; completedOn?: string }): { label: string; colorClass: string } | null {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Use timelineService.parseDate() — handles both dd-MM-yyyy (backend) and
        // yyyy-MM-dd (API / optimistic-update format) correctly as local midnight.
        // parseDateFromBackend() falls back to new Date() for yyyy-MM-dd which is UTC
        // and shifts the day backwards in IST (+5:30), causing false "overdue" results.
        if (item.status === 'COMPLETED') {
            if (item.completedOn && item.endDate) {
                const completedDate = this.timelineService.parseDate(item.completedOn);
                const endDate = this.timelineService.parseDate(item.endDate);
                if (completedDate && endDate) {
                    completedDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    if (completedDate <= endDate) {
                        const earlyDays = Math.floor((endDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (earlyDays > 0) {
                            return { label: `${this.formatDurationText(earlyDays)} early`, colorClass: 'text-green-600 bg-green-50' };
                        }
                        return { label: 'On time', colorClass: 'text-green-600 bg-green-50' };
                    } else {
                        const lateDays = Math.ceil((completedDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
                        return { label: `+${this.formatDurationText(lateDays)} late`, colorClass: 'text-red-600 bg-red-50' };
                    }
                }
            }
            return null;
        }

        // Active (non-completed, non-cancelled) items — check if overdue
        if (item.status === 'CANCELLED') return null;

        if (item.endDate) {
            const endDate = this.timelineService.parseDate(item.endDate);
            if (endDate) {
                endDate.setHours(0, 0, 0, 0);
                if (today > endDate) {
                    const overdueDays = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
                    return { label: `Overdue ${this.formatDurationText(overdueDays)}`, colorClass: 'text-orange-600 bg-orange-50' };
                }
            }
        }

        return null;
    }

    //Get status color class
    getStatusClass(status?: string): string {
        const statusUpper = status?.toUpperCase() || '';

        if (statusUpper === 'COMPLETED' || statusUpper === 'DONE') {
            return 'status-completed';
        } else if (statusUpper === 'ONGOING' || statusUpper === 'IN_PROGRESS') {
            return 'status-ongoing';
        } else if (statusUpper === 'ON_HOLD' || statusUpper === 'REVIEW') {
            return 'status-on-hold';
        } else if (statusUpper === 'OPEN' || statusUpper === 'TO_DO' || statusUpper === 'NOT_STARTED') {
            return 'status-open';
        }
        return 'status-open';
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
        const phasesData = this.sortedPhases();
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
                completedOn: phase.completedOn,
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
                completedOn: task.completedOn,
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

    // Export modal methods
    toggleExportMenu() {
        this.showExportMenu.update(show => !show);
    }

    openExportModal() {
        this.showExportMenu.set(false);
        this.showExportModal.set(true);
    }

    closeExportModal() {
        this.showExportModal.set(false);
    }

    // Close export menu when clicking outside
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const exportMenu = document.querySelector('.export-menu-container');
        const exportButton = document.querySelector('.export-menu-button');

        if (exportMenu && !exportMenu.contains(target) && exportButton && !exportButton.contains(target)) {
            this.showExportMenu.set(false);
        }

        // Close sort menu when clicking outside
        const sortContainer = document.querySelector('.sort-container');
        if (sortContainer && !sortContainer.contains(target)) {
            this.isSortMenuOpen.set(false);
        }

        // Close dependency type popup when clicking outside
        const depPopup = document.querySelector('.dependency-type-popup');
        if (depPopup && !depPopup.contains(target)) {
            this.showDependencyTypePopup.set(null);
        }
    }

    // ===== Dependency Linking Methods =====

    /** Load dependencies from backend */
    loadDependencies(projectId: number) {
        this.timelineService.getDependencies(projectId).subscribe({
            next: (deps) => this.dependencies.set(deps),
            error: (err) => console.error('Error loading dependencies:', err)
        });
    }

    /** Calculate Y center position for a phase row */
    getPhaseRowCenterY(phaseId: number): number | null {
        const phasesData = this.sortedPhases();
        const expanded = this.expandedPhases();
        let y = 0;

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

    /** Enter dependency linking mode */
    enterLinkMode() {
        this.isLinkMode.set(true);
        this.linkPredecessorId.set(null);
        this.previewLineEnd.set(null);
        this.showDependencyTypePopup.set(null);
        this.selectedDependencyId.set(null);
    }

    /** Cancel dependency linking mode */
    cancelLinkMode() {
        this.isLinkMode.set(false);
        this.linkPredecessorId.set(null);
        this.previewLineEnd.set(null);
        this.showDependencyTypePopup.set(null);
    }

    /** Handle click on a phase bar's link circle */
    onLinkCircleClick(event: MouseEvent, phaseId: number) {
        event.stopPropagation();
        event.preventDefault();

        const predecessorId = this.linkPredecessorId();

        if (predecessorId === null) {
            // First click — select predecessor
            this.linkPredecessorId.set(phaseId);
        } else {
            // Second click — select successor
            if (predecessorId === phaseId) {
                this.showToast('Cannot link a phase to itself');
                return;
            }

            // Check for duplicate
            const exists = this.dependencies().some(
                d => d.predecessorId === predecessorId && d.successorId === phaseId
            );
            if (exists) {
                this.showToast('This dependency already exists');
                return;
            }

            // Show dependency type popup
            const rect = (event.target as HTMLElement).getBoundingClientRect();
            this.showDependencyTypePopup.set({
                predecessorId,
                successorId: phaseId,
                x: rect.left,
                y: rect.bottom + 8
            });
        }
    }

    /** Handle mouse move during link mode for preview line */
    onPreviewMouseMove(event: MouseEvent) {
        if (!this.isLinkMode() || this.linkPredecessorId() === null) return;

        const wrapper = (event.currentTarget as HTMLElement);
        const rect = wrapper.getBoundingClientRect();
        this.previewLineEnd.set({
            x: event.clientX - rect.left + wrapper.scrollLeft,
            y: event.clientY - rect.top + wrapper.scrollTop
        });
    }

    /** Get preview line path from predecessor to mouse */
    getPreviewLinePath(): string {
        const predId = this.linkPredecessorId();
        const mousePos = this.previewLineEnd();
        if (predId === null || !mousePos) return '';

        const predPhase = this.phases().find(p => p.phaseId === predId);
        if (!predPhase) return '';

        const predBar = this.calculateBarPosition(predPhase.startDate, predPhase.endDate);
        const predY = this.getPhaseRowCenterY(predId);
        if (predY === null) return '';

        const x1 = predBar.left + predBar.width - 8; // Right edge of bar
        return `M ${x1} ${predY} L ${mousePos.x} ${mousePos.y}`;
    }

    /** Select dependency type and create the dependency */
    selectDependencyType(type: 'FS' | 'SS' | 'FF' | 'SF') {
        const popup = this.showDependencyTypePopup();
        if (!popup) return;

        const dep: PhaseDependency = {
            predecessorId: popup.predecessorId,
            successorId: popup.successorId,
            dependencyType: type
        };

        // Optimistically add to local state
        this.dependencies.update(deps => [...deps, dep]);

        // Reset link mode
        this.showDependencyTypePopup.set(null);
        this.linkPredecessorId.set(null);
        this.previewLineEnd.set(null);

        this.showToast('Dependency created');

        // Call backend
        const projectId = this.selectedProject()?.projectId;
        if (projectId) {
            this.timelineService.createDependency(projectId, {
                predecessorId: dep.predecessorId,
                successorId: dep.successorId,
                dependencyType: dep.dependencyType
            }).subscribe({
                next: (created) => {
                    // Force a reload of phases and dependencies to show updated dates silently without remounting
                    this.loadPhases(projectId, true);
                },
                error: (err) => {
                    console.error('Error creating dependency:', err);
                    
                    // Show exact error message from backend if available
                    let errorMessage = 'Failed to save dependency';
                    if (err?.error?.message) {
                        errorMessage = err.error.message;
                    } else if (typeof err?.error === 'string') {
                        errorMessage = err.error;
                    } else if (err?.message) {
                        errorMessage = err.message;
                    }
                    
                    this.showToast(errorMessage);

                    // Revert the optimistic UI update
                    this.dependencies.update(deps =>
                        deps.filter(d => !(
                            d.predecessorId === dep.predecessorId && 
                            d.successorId === dep.successorId && 
                            d.dependencyType === dep.dependencyType
                        ))
                    );
                }
            });
        }
    }

    /** Handle click on a dependency line */
    onDependencyLineClick(event: MouseEvent, dep: PhaseDependency) {
        event.stopPropagation();
        const currentSelected = this.selectedDependencyId();
        if (currentSelected === dep.id) {
            // Already selected — delete it
            this.deleteDependency(dep);
        } else {
            this.selectedDependencyId.set(dep.id ?? null);
        }
    }

    /** Delete a dependency */
    deleteDependency(dep: PhaseDependency) {
        // Optimistically remove from local state
        this.dependencies.update(deps =>
            deps.filter(d => !(d.predecessorId === dep.predecessorId && d.successorId === dep.successorId && d.dependencyType === dep.dependencyType))
        );
        this.selectedDependencyId.set(null);
        this.showToast('Dependency deleted');

        // Call backend
        const projectId = this.selectedProject()?.projectId;
        if (projectId && dep.id) {
            this.timelineService.deleteDependency(projectId, dep.id).subscribe({
                error: (err) => {
                    console.error('Error deleting dependency:', err);
                    this.showToast('Failed to delete dependency');
                    // Re-add on failure
                    this.dependencies.update(deps => [...deps, dep]);
                }
            });
        }
    }

    /** Show a temporary toast message */
    showToast(message: string) {
        if (this.toastTimeout) {
            clearTimeout(this.toastTimeout);
        }
        this.toastMessage.set(message);
        this.toastTimeout = setTimeout(() => {
            this.toastMessage.set(null);
            this.toastTimeout = null;
        }, 3000);
    }

    /** Get link mode status text */
    getLinkModeStatus(): string {
        if (this.linkPredecessorId() !== null) {
            return 'Now select a successor phase';
        }
        return 'Select a predecessor phase';
    }
}
