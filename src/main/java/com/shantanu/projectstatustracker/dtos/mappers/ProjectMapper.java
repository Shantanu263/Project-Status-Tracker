package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.*;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Set;

@Mapper(componentModel = "spring",uses = {ProjectMemberMapper.class, RoleMapper.class})
public interface ProjectMapper {

    @Mapping(source = "project.projectMembers", target = "projectMembers")
    ProjectResponseDTO mapProjectResponse(Project project);

    @Mapping(source = "project.projectMembers",target = "projectMembers")
    List<ProjectResponseDTO> mapProjects(List<Project> projects);

    Project mapProjectRequestDTOToProject(ProjectRequestDTO projectRequestDTO);

    Project mapUpdateRequestToProject(ProjectUpdateRequestDTO projectUpdateRequestDTO);

}
