package com.shantanu.projectstatustracker.models;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;
import java.util.Date;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Entity
public class Phase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "phase_id")
    private Long phaseId;

    private String phaseName;

    @Column(length = 1000)
    private String description;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date completedAt;

    @Enumerated(EnumType.STRING)
    private PhaseStatus status;

    private Double progress;

    private LocalDateTime updatedAt;

    @ManyToOne
    @JoinColumn(name = "project_id")
    @JsonBackReference
    private Project project;

    @ManyToOne
    @JoinColumn(name = "projectMember_id")
    @JsonBackReference
    private ProjectMember assignedTo;

    @OneToMany(mappedBy = "projectPhase", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    List<Task> tasks;

    @OneToMany
    @JoinColumn(name = "entity_id", referencedColumnName = "phase_id",
            insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "none"))
    @SQLRestriction("entity_type = 'PHASE'")
    private List<ActivityLog> logs;

    @PrePersist
    protected void onCreate() {
        this.progress = 0.0;
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

}
