package com.shantanu.projectstatustracker.dtos.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LabelCountDTO {
    private String label;
    private long count;
}
