package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class ProjectMemberResponseDTO {

    private Long memberId;

    private String user;

    private Long userId;

    private String email;

    private String project;

    private String role;

    private UserResponseDTO assignedBy;

    private Boolean isActive;

}
