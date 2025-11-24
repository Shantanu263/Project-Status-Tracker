package com.shantanu.projectstatustracker.dtos.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PhaseProgressDTO {
    private String phaseName;
    private double percentComplete;
}
