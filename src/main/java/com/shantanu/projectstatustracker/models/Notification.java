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
    private ProjectMember projectMember;

    @Column(length = 500)
    private String message;

    private LocalDateTime createdAt;

    private Boolean isRead;

    //private String type;  Use case ?

    @PrePersist
    public void onCreate(){
        this.createdAt = LocalDateTime.now();
        this.isRead = false;
    }

}
