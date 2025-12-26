package com.shantanu.projectstatustracker.dtos.superDashboard;

import lombok.Data;

import java.util.Date;

@Data
public class ProjectCardDTO {
            Long projectId;
            String projectName;
            String status;
            double progress;
            Date startDate;
            Date endDate;
            long phaseCount;
            long totalTasks;
            long overdueTasks;
}
