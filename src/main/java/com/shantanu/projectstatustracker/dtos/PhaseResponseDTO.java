package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class PhaseResponseDTO {
    private Long phaseId;
    private String phaseName;
    private Double progress;
}
