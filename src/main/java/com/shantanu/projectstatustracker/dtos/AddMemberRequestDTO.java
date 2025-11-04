package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.ProjectRole;
import lombok.Data;

@Data
public class AddMemberRequestDTO {

    String email;

    ProjectRole roleInProject;

}

