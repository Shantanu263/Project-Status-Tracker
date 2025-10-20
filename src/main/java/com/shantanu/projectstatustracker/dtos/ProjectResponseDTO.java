package com.shantanu.projectstatustracker.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.shantanu.projectstatustracker.models.Phase;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.Set;

@Data
@Builder
public class ProjectResponseDTO {
    private Long projectId;

    private String projectName;

    private String description;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    private String status;

    private String priority;

    private Double progress;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private UserResponseDTO projectHead;

    private UserResponseDTO createdBySuperAdmin;

    private Set<PhaseResponseDTO> phases;
}
