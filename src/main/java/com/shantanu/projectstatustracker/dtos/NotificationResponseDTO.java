package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.EntityType;
import com.shantanu.projectstatustracker.models.NotificationType;
import com.shantanu.projectstatustracker.models.User;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class NotificationResponseDTO {

    private Long id;

    private Long userId;

    private String title;

    @Column(length = 500)
    private String message;

    private LocalDateTime createdAt;

    private Boolean isRead;

    private NotificationType type;

    private Long entityId;

    private EntityType entityType;

}
