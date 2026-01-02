package com.shantanu.projectstatustracker.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.shantanu.projectstatustracker.models.Status;
import lombok.Data;

import java.util.Date;
import java.util.List;

@Data
public class SubTaskResponseDTO {

    private Long subTaskId;

    private String subTaskName;

    private Long taskId;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    private Status status;

    private String priority;

    private Long assignedToProjectMemberId;

    private List<CommentResponseDTO> comments;

}
