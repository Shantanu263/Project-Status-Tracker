package com.shantanu.projectstatustracker.dtos.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TasksOverTimeDTO {
    private String date;
    private long completed;
}
