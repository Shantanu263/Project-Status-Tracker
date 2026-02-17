package com.shantanu.projectstatustracker.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "notification_log")
public class NotificationEmail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private EntityType entityType;        // PHASE | TASK | SUBTASK

    private Long entityId;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private NotificationType notificationType;  // NEARING_DEADLINE | OVERDUE

    private LocalDateTime sentAt;

    @PrePersist
    protected void onCreate() {
        this.sentAt = LocalDateTime.now();
    }

}
