package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.ProjectRole;
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

    private String memberStatus;

}
