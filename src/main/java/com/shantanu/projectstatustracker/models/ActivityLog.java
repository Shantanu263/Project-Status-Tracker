package com.shantanu.projectstatustracker.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
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
    @JsonIgnore
    private Project project;

    // Who performed the activity
    @ManyToOne
    @JoinColumn(name = "performed_by")
    @JsonIgnore
    private User performedBy;

    // Full message shown in UI
    @Column(length = 1000)
    private String message;

    // When it happened
    private Timestamp createdAt = new Timestamp(System.currentTimeMillis());

    @Column(name = "entity_id")
    private Long entityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type")
    private EntityType entityType;

}

