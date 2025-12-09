package com.shantanu.projectstatustracker.models;

import com.fasterxml.jackson.annotation.JsonBackReference;
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
@Table(name = "project_template_phase")
public class ProjectTemplatePhase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String phaseName;

    @ManyToOne
    @JoinColumn(name = "projectTemplate_id")
    @JsonBackReference
    private ProjectTemplate projectTemplate;

    //private Double progress;

    private Integer orderIndex;

//    @PrePersist
//    public void onCreate(){
//        this.progress = 0.0;
//    }

}
