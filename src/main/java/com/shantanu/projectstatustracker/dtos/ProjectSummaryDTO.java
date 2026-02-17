package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class ProjectSummaryDTO {

    // Header
    private String companyLogo;
    private String projectName;
    private String projectStatus;
    private String projectStatusClass;
    private String reportDate;

    // Overview
    private String projectDescription;
    private String projectStartDate;
    private String projectEndDate;
    private String currentPhase;
    private int overallProgress;

    // Text sections (HTML-safe)
    private String currentStatusHtml;
    private String nextStepsHtml;

    // Tables
    private String phaseTaskRowsHtml;
    private String teamMembersHtml;

    // Footer
    private String companyName;
}

