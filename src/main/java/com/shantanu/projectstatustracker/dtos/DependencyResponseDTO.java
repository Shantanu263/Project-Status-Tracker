package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class DependencyResponseDTO {
    Long id;
    Long predecessorId;
    Long successorId;
    String dependencyType;
}
