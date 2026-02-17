package com.shantanu.projectstatustracker.dtos;


import com.shantanu.projectstatustracker.models.TaskStatus;
import lombok.Data;

import java.util.Date;

@Data
public class TaskRequestDTO {

    private String taskName;

    private String description;

    private Date startDate;

    private Date endDate;

    private TaskStatus status;

    private String priority;

    private Long assignedTo;

}
