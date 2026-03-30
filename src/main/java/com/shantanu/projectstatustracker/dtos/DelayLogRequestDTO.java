package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.EntityType;
import lombok.Data;

import java.util.Date;

@Data
public class DelayLogRequestDTO {

    private Long projectId;
    private Long phaseId;
    private Long taskId;

    private EntityType entityType;

    private Date originalEndDate;
    private Date revisedEndDate;

    private String status;

    private Long assigneeId;

    private String reason;

}
