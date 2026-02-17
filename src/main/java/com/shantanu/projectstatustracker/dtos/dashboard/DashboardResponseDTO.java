package com.shantanu.projectstatustracker.dtos.dashboard;

import com.shantanu.projectstatustracker.dtos.superDashboard.ProjectRadarChartDTO;
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
    private List<ProjectRadarChartDTO> projectRadarChart;
    private List<LabelCountDTO> taskDistribution;
    private List<TasksOverTimeDTO> tasksOverTime;
    private List<PriorityCountDTO> priorityDistribution;

    private List<UpcomingDeadlineDTO> upcomingDeadlines;
    private List<ActivityLogDTO> recentActivity;
}
