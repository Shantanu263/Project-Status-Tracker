package com.shantanu.projectstatustracker.dtos;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.ProjectMember;
import jakarta.persistence.*;
import lombok.Data;

import java.util.Date;

@Data
public class TaskRequestDTO {

    private String taskName;

    private String description;

    private Date startDate;

    private Date endDate;

    private String status;

    private String priority;

    private Long assignedTo;

}
