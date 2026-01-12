package com.shantanu.projectstatustracker.models;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.annotation.Nullable;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "project_members")
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id", nullable = false, updatable = false)
    private Long memberId;

    @ManyToOne
    @JoinColumn(name = "project_project_id", nullable = false)
    @JsonBackReference
    private Project project;

    @ManyToOne
    @JoinColumn(name = "user_user_id")
    @JsonBackReference
    private User user;

    @Column(name = "role", nullable = false)
    @Enumerated(EnumType.STRING)
    private ProjectRole role;

    @ManyToOne
    @JoinColumn(name = "assigned_by_user_id", nullable = false)
    private User assignedBy;

    private Boolean isActive;

    @PrePersist
    public void onCreate(){
        this.isActive = true;
    }

}
