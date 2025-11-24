package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.ProjectMemberResponseDTO;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.ProjectRole;
import com.shantanu.projectstatustracker.models.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.springframework.data.domain.Page;

import java.util.List;

@Mapper(componentModel = "spring", uses = {RoleMapper.class})
public interface ProjectMemberMapper {

    @Mapping(source = "projectMember.user.name",target = "user")
    @Mapping(source = "projectMember.project.projectName",target = "project")
    @Mapping(source = "projectMember.role",target = "role")
    @Mapping(source = "projectMember.assignedBy", target = "assignedBy")
    @Mapping(source = "projectMember.memberStatus", target = "memberStatus")
    ProjectMemberResponseDTO mapProjectMember(ProjectMember projectMember);

    @Mapping(source = "projectMember.user.name",target = "user")
    @Mapping(source = "projectMember.project.projectName",target = "project")
    @Mapping(source = "projectMember.role",target = "role")
    @Mapping(source = "projectMember.assignedBy", target = "assignedBy")
    @Mapping(source = "projectMember.memberStatus", target = "memberStatus")
    @Mapping(source = "projectMember.memberId",target = "memberId")
    List<ProjectMemberResponseDTO> mapProjectMembers(List<ProjectMember> projectMembers);

    @Mapping(source = "user" , target = "user")
    @Mapping(source = "role", target = "role")
    ProjectMember mapRequestToProjectMember(Project project, User user, User assignedBy, ProjectRole role);

//    default Page<ProjectMemberResponseDTO> toDtoPage(Page<ProjectMember> page) {
//        return page.map(this::mapProjectMember);
//    }

}
