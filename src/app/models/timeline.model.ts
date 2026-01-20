/**
 * Timeline-specific models for the Gantt chart component
 */

export enum TimeScale {
    WEEK = 'WEEK',
    MONTH = 'MONTH',
    QUARTER = 'QUARTER'
}

export interface TimelineGridCell {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
    isToday?: boolean;
}

export interface TimelineBar {
    id: string;
    type: 'phase' | 'task';
    phaseId?: number;
    taskId?: number;
    name: string;
    startDate: string;
    endDate: string;
    completedAt?: string;
    progress?: number;
    assignedTo?: number;
    assignedToName?: string;
    status?: string;
    left: number;
    width: number;
}

export interface TimelineRow {
    id: string;
    type: 'phase' | 'task';
    phaseId?: number;
    taskId?: number;
    name: string;
    startDate?: string;
    endDate?: string;
    progress?: number;
    completedAt?: string;
    assignedToName?: string;
    status?: string;
    isExpanded?: boolean;
    level: number; // 0 for phase, 1 for task
}

export interface DragState {
    barId: string;
    type: 'move' | 'resize-left' | 'resize-right';
    startX: number;
    startLeft?: number;
    startWidth?: number;
    originalStartDate: string;
    originalEndDate: string;
    initialTooltipY?: number; // Initial Y position for fixed tooltip vertical position
}

export interface TimelineBounds {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    paddingDays: number;
}
