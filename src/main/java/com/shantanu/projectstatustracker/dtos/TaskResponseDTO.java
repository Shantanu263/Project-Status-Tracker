package com.shantanu.projectstatustracker.dtos;


import com.fasterxml.jackson.annotation.JsonFormat;
import com.shantanu.projectstatustracker.models.Comment;
import com.shantanu.projectstatustracker.models.Status;
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

    private Status status;

    private String priority;

    private Long assignedToProjectMemberId;

    private List<Comment> comments;

}
