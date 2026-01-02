package com.shantanu.projectstatustracker.models;


import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLRestriction;

import java.util.Date;
import java.util.List;

@Entity
@Table(name = "tasks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "task_id")
    private Long taskId;

    private String taskName;

    @Column(length = 1000)
    private String description;

    @ManyToOne
    @JsonBackReference
    private Phase projectPhase;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    private Date completedAt;

    @Enumerated(EnumType.STRING)
    private Status status;

    private String priority;

    @ManyToOne
    @JsonIgnore
    private ProjectMember assignedTo;

    @OneToMany(mappedBy = "task")
    @JsonManagedReference
    private List<SubTask> subTasks;

    private Double progress;

    @OneToMany
    @JoinColumn(name = "parent_id", referencedColumnName = "task_id",
            insertable = false, updatable = false)
    @SQLRestriction("parent_type = 'TASK'")
    private List<Comment> comments;

    @OneToMany
    @JoinColumn(name = "entity_id", referencedColumnName = "task_id",
            insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "none"))
    @SQLRestriction("entity_type = 'TASK'")
    private List<ActivityLog> logs;

}


