package com.shantanu.projectstatustracker.dtos.dashboard;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.Date;

@Data
@AllArgsConstructor
public class UpcomingDeadlineDTO {
    private String taskName;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date deadline;
    private String assignedTo;
    private long daysLeft;
}
