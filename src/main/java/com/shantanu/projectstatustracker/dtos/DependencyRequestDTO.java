package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.DependencyType;
import lombok.Data;

@Data
public class DependencyRequestDTO {
    Long predecessorId;
    Long successorId;
    DependencyType dependencyType;
}
