package com.shantanu.projectstatustracker.dtos;


import com.shantanu.projectstatustracker.models.Status;
import lombok.Data;

import java.util.Date;

@Data
public class TaskRequestDTO {

    private String taskName;

    private String description;

    private Date startDate;

    private Date endDate;

    private Status status;

    private String priority;

    private Long assignedTo;

}
