package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.PhaseDetailsResponseDTO;
import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.dtos.PhaseResponseDTO;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.ProjectMember;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring", uses = {TaskMapper.class})
public interface PhaseMapper {

    PhaseResponseDTO mapPhaseToPhaseResponseDTO(Phase phase);

    @Mapping(source = "phaseRequestDTO.startDate",target = "startDate")
    @Mapping(source = "phaseRequestDTO.endDate",target = "endDate")
    @Mapping(source = "phaseRequestDTO.status",target = "status")
    @Mapping(source = "project",target = "project")
    @Mapping(source = "projectMember",target = "assignedTo")
    @Mapping(source = "phaseRequestDTO.description", target = "description")
    Phase mapRequestToPhase(PhaseRequestDTO phaseRequestDTO, Project project, ProjectMember projectMember);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(source = "assignedTo",target = "phase.assignedTo")
    void updatePhaseFromDTO(PhaseRequestDTO phaseRequestDTO, ProjectMember assignedTo, @MappingTarget Phase phase);

    @Mapping(source = "phase.project.projectId", target = "projectId")
    @Mapping(source = "phase.assignedTo.memberId", target = "projectMemberId")
    @Mapping(source = "phase.completedOn", target = "completedOn")
    PhaseDetailsResponseDTO mapPhaseToPhaseDetailsResponse(Phase phase);

    List<PhaseDetailsResponseDTO> mapPhasesToPhaseDetailsResponse(List<Phase> phases);

}
