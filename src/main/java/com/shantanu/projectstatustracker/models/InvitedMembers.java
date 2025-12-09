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
@Table(name = "invited_members")
public class InvitedMembers {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String email;

    private Long projectId;

    @Enumerated(EnumType.STRING)
    private ProjectRole role;

    @ManyToOne
    private User assignedBy;

}
