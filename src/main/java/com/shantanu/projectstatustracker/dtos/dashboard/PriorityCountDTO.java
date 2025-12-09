package com.shantanu.projectstatustracker.dtos.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class PriorityCountDTO {
    private String priority;
    private long count;
}
