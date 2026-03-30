package com.shantanu.projectstatustracker.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Table(name = "task_dependencies")
public class TaskDependency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    private Task predecessor;

    @ManyToOne
    private Task successor;

    @ManyToOne
    @JoinColumn(name = "phase_id")
    private Phase phase;

    @Enumerated(EnumType.STRING)
    private DependencyType dependencyType;

}
