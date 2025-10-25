package com.shantanu.projectstatustracker.models;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    private Project project;

    @ManyToOne
    @JoinColumn(name = "user_user_id")
    private User user;

    @Column(name = "role", nullable = false)
    private String role;

    @ManyToOne
    @JoinColumn(name = "assigned_by_user_id", nullable = false)
    private User assignedBy;

    private String memberStatus;  //remove this -> not required

    @PrePersist
    public void onCreate(){
        this.memberStatus = "ACTIVE";
    }
}
