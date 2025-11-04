package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.ProjectRole;
import lombok.Data;

@Data
public class ProjectMemberResponseDTO {

    private String memberId;

    private String user;

    private String project;

    private String role;

    private UserResponseDTO assignedBy;

    private String memberStatus;

}
