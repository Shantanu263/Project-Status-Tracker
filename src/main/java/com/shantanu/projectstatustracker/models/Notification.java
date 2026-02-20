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
@Table(name = "notifications")
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    private String title;

    @Column(length = 500)
    private String message;

    private LocalDateTime createdAt;

    private Boolean isRead;

    private NotificationType type;

    private Long entityId;
    private EntityType entityType;
    private Long projectId;

    @PrePersist
    public void onCreate(){
        this.createdAt = LocalDateTime.now();
        this.isRead = false;
    }

}
