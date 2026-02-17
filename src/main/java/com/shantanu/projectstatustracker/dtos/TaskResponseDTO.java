package com.shantanu.projectstatustracker.dtos;


import com.fasterxml.jackson.annotation.JsonFormat;
import com.shantanu.projectstatustracker.models.TaskStatus;
import lombok.Data;

import java.util.Date;
import java.util.List;

@Data
public class TaskResponseDTO {

    private Long taskId;

    private String taskName;

    private String description;

    private Long projectPhaseId;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date completedAt;

    private TaskStatus status;

    private String priority;

    private Long assignedToProjectMemberId;

    private List<CommentResponseDTO> comments;

    private List<ActivityLogDTO> logs;

    private List<SubTaskResponseDTO> subTasks;

    private Double progress;

}
