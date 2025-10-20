package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.dtos.PhaseResponseDTO;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface PhaseMapper {

    PhaseResponseDTO mapPhaseToPhaseResponseDTO(Phase phase);

    @Mapping(source = "phaseRequestDTO.startDate",target = "startDate")
    @Mapping(source = "phaseRequestDTO.endDate",target = "endDate")
    @Mapping(source = "phaseRequestDTO.status",target = "status")
    @Mapping(source = "project",target = "project")
    Phase mapRequestToPhase(PhaseRequestDTO phaseRequestDTO, Project project);
}
