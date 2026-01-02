package com.shantanu.projectstatustracker.dtos.superDashboard;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectRadarChartDTO {
    String metric;
    double score; // 0 – 100
}
