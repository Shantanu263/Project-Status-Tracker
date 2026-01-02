package com.shantanu.projectstatustracker.dtos.superDashboard;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class ProjectProgressChartDTO {
    Long projectId;
    String projectName;
    double progress;
}
