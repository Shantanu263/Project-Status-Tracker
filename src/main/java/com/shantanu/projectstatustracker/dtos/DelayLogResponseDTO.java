package com.shantanu.projectstatustracker.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.shantanu.projectstatustracker.models.EntityType;
import lombok.Data;

import java.util.Date;

@Data
public class DelayLogResponseDTO {
    private Long delayLogId;
    private Long projectId;
    private Long phaseId;
    private Long taskId;

    private EntityType entityType;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date originalEndDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date revisedEndDate;

    private String status;

    private Long assigneeId;

    private String reason;
}
