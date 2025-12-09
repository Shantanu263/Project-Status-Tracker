export interface DashboardData {
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    totalPhases: number;
    totalMembers: number;
    assignedTasks: number;
    overallProgress: number;
    phaseProgress: PhaseProgress[];
    taskDistribution: TaskDistribution[];
    tasksOverTime: TasksOverTime[];
    priorityDistribution: PriorityDistribution[];
    upcomingDeadlines: UpcomingDeadline[];
    recentActivity: RecentActivity[];
}

export interface PhaseProgress {
    phaseId: number;
    phaseName: string;
    percentComplete: number;
}

export interface TaskDistribution {
    label: string;
    count: number;
}

export interface TasksOverTime {
    date: string;
    completed: number;
}

export interface PriorityDistribution {
    priority: string;
    count: number;
}

export interface UpcomingDeadline {
    taskName: string;
    deadline: string;
    assignedTo: string;
    daysLeft: number;
}

export interface RecentActivity {
    name: string;
    message: string;
    timeAgo: string;
}
