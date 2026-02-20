package com.shantanu.projectstatustracker.dtos.superDashboard;

import com.shantanu.projectstatustracker.models.ProjectStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectStatusChartDTO {
    ProjectStatus status;
    long count;
}

