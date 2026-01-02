package com.shantanu.projectstatustracker.dtos.superDashboard;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectStatusChartDTO {
    String status;
    long count;
}

