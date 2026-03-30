package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

import java.util.List;

@Data
public class DelayReportRequestDTO {
    private List<Long> delayIds;
}
