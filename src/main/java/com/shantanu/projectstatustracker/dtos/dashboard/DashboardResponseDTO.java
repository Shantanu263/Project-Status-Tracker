package com.shantanu.projectstatustracker.dtos.dashboard;

import lombok.Data;

import java.util.List;

@Data
public class DashboardResponseDTO {
    private int totalTasks;
    private int completedTasks;
    private int pendingTasks;
    private int overdueTasks;

    private int totalPhases;
    private int totalMembers;
    private int assignedTasks;

    private double overallProgress;

    private List<PhaseProgressDTO> phaseProgress;
    private List<LabelCountDTO> taskDistribution;
    private List<TasksOverTimeDTO> tasksOverTime;
    private List<PriorityCountDTO> priorityDistribution;

    private List<UpcomingDeadlineDTO> upcomingDeadlines;
    private List<ActivityLogDTO> recentActivity;
}
