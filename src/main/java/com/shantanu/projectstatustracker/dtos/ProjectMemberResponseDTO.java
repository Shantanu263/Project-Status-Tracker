package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class ProjectMemberResponseDTO {
    private String user;

    private String project;

    private String role;

    private UserResponseDTO assignedBy;

    private String memberStatus;

}
