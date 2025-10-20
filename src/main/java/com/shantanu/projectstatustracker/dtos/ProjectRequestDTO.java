package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

import java.util.Date;

@Data
public class ProjectRequestDTO {

    String projectName;

    String description;

    Date startDate;

    Date endDate;

    String priority;

    Long projectHeadId;
}
