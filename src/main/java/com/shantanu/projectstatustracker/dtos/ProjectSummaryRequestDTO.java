package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class ProjectSummaryRequestDTO {

    private String email;
    private String currentStatusHtml;
    private String nextStepsHtml;

    private Boolean recentlyCompletedTasks;
    private Boolean upcomingTasks;

}
