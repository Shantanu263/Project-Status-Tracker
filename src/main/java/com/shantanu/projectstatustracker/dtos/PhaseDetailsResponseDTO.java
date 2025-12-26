package com.shantanu.projectstatustracker.dtos;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Data
public class PhaseDetailsResponseDTO {

    private Long phaseId;

    private String phaseName;

    private String description;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    private String status;

    private Double progress;

    private LocalDateTime updatedAt;

    private Long projectId;

    private Long projectMemberId;

    private List<TaskResponseDTO> tasks;

}
