package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.ProjectStatus;
import lombok.Data;

import java.util.Date;

@Data
public class ProjectUpdateRequestDTO {

    String projectName;

    String description;

    String client;

    Date startDate;

    Date endDate;

    String priority;

    ProjectStatus status;
}
