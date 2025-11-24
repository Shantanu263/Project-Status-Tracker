package com.shantanu.projectstatustracker.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;

@Entity
@Table(name = "activity_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Project this activity belongs to
    @ManyToOne
    @JoinColumn(name = "project_id")
    private Project project;

    // Who performed the activity
    @ManyToOne
    @JoinColumn(name = "performed_by")
    private User performedBy;

    // Full message shown in UI
    @Column(length = 1000)
    private String message;

    // When it happened
    private Timestamp createdAt = new Timestamp(System.currentTimeMillis());

}

