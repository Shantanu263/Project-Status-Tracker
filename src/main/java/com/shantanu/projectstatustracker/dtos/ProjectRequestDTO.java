package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

import java.util.Date;

@Data
public class ProjectRequestDTO {

    String projectName;

    String description;

    String client;

    Date startDate;

    Date endDate;

    String Status;

    String priority;

//    Long projectHeadId;

    Long templateId;

}
