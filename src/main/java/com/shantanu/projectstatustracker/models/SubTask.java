package com.shantanu.projectstatustracker.models;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLRestriction;

import java.util.Date;
import java.util.List;

@Entity
@Table(name = "sub_tasks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "sub_task_id")
    private Long subTaskId;

    private String subTaskName;

    @ManyToOne
    @JsonBackReference
    @JsonIgnore
    private Task task;

    //@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    //@JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    //private Date completedOn;

    @Enumerated(EnumType.STRING)
    private TaskStatus status;

    private String priority;

    @ManyToOne
    @JsonIgnore
    private ProjectMember assignedTo;

    @OneToMany
    @JoinColumn(name = "parent_id", referencedColumnName = "sub_task_id",
            insertable = false, updatable = false)
    @SQLRestriction("parent_type = 'SUBTASK'")
    private List<Comment> comments;

    @OneToMany
    @JoinColumn(name = "entity_id", referencedColumnName = "sub_task_id",
            insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "none"))
    @SQLRestriction("entity_type = 'SUBTASK'")
    private List<ActivityLog> logs;

}
