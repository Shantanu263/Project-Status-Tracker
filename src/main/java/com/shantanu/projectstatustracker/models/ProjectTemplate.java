package com.shantanu.projectstatustracker.models;


import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "project_templates")
public class ProjectTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String templateName;

    @Column(length = 1000)
    private String description;

    @OneToMany(mappedBy = "projectTemplate",cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonManagedReference
    private List<ProjectTemplatePhase> projectTemplatePhases;

}
