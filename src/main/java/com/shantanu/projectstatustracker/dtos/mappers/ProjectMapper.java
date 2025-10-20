package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.*;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Set;

@Mapper(componentModel = "spring")
public interface ProjectMapper {

    ProjectResponseDTO mapProjectToProjectResponseDTO(Project project, UserResponseDTO projectHead, UserResponseDTO superAdmin, Set<PhaseResponseDTO> phases);


    ProjectResponseDTO mapProjectResponse(Project project);

    List<ProjectResponseDTO> mapProjects(List<Project> projects);

    Project mapProjectRequestDTOToProject(ProjectRequestDTO projectRequestDTO);

    Project mapUpdateRequestToProject(ProjectUpdateRequestDTO projectUpdateRequestDTO);
}
