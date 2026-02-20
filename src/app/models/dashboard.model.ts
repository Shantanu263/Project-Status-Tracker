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
    projectRadarChart: ProjectRadarMetric[];
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

export interface ProjectRadarMetric {
    metric: string;
    score: number;
}

// Projects Dashboard Interfaces
export interface ProjectsDashboardData {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    delayedProjects: number;
    averageProgress: number;
    projectCardDTOS: ProjectCard[];
    projectProgressChart: ProjectProgress[];
    projectStatusChart: ProjectStatusCount[];
}

export interface ProjectCard {
    projectId: number;
    projectName: string;
    status: string;
    progress: number;
    startDate: string;
    endDate: string;
    phaseCount: number;
    totalTasks: number;
    overdueTasks: number;
    priority?: string;
    completedOn?: string;
    client?: string;
}

export interface ProjectProgress {
    projectId: number;
    projectName: string;
    progress: number;
}

export interface ProjectStatusCount {
    status: string;
    count: number;
}

