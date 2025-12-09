package com.shantanu.projectstatustracker.dtos.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ActivityLogDTO {
    private String name;
    private String message;
    private String timeAgo;
}