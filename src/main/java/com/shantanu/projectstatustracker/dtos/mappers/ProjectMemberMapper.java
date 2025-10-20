package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.ProjectMemberResponseDTO;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface ProjectMemberMapper {

    @Mapping(source = "projectMember.user.name",target = "user")
    @Mapping(source = "projectMember.project.projectName",target = "project")
    @Mapping(source = "projectMember.user.role.name",target = "role")
    @Mapping(source = "projectMember.assignedBy", target = "assignedBy")
    ProjectMemberResponseDTO mapProjectMember(ProjectMember projectMember);

    @Mapping(source = "projectMember.user.name",target = "user")
    @Mapping(source = "projectMember.project.projectName",target = "project")
    @Mapping(source = "projectMember.user.role.name",target = "role")
    @Mapping(source = "projectMember.assignedBy", target = "assignedBy")
    List<ProjectMemberResponseDTO> mapProjectMembers(List<ProjectMember> projectMembers);

    @Mapping(source = "user" , target = "user")
    @Mapping(source = "user.role.name", target = "role")
    ProjectMember mapResponseToProjectMember(Project project, User user, User assignedBy);

}
