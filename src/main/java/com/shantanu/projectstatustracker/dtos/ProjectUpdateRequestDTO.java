package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

import java.util.Date;

@Data
public class ProjectUpdateRequestDTO {

    String projectName;

    String description;

    Date startDate;

    Date endDate;

    String priority;

    String  status;
}
