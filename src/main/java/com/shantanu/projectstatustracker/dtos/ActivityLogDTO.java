package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class ActivityLogDTO{
    Long id;
    Long projectId;
    Long userId;
    String message;
    String createdAt;
    Long entityId;
}
