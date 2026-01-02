package com.shantanu.projectstatustracker.dtos.superDashboard;

import lombok.Data;

import java.util.List;

@Data
public class DashboardSummaryDTO {
    long totalProjects;
    long activeProjects;
    long completedProjects;
    long delayedProjects;
    double averageProgress;

    List<ProjectCardDTO> projectCardDTOS;

    List<ProjectStatusChartDTO> projectStatusChart;

    List<ProjectRadarChartDTO> projectRadarChart;

    List<ProjectPriorityChartDTO> projectPriorityChart;

    List<ProjectProgressBucketDTO> projectProgressChart;

}
