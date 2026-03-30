package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.DependencyResponseDTO;
import com.shantanu.projectstatustracker.models.PhaseDependency;
import com.shantanu.projectstatustracker.models.TaskDependency;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface DependencyMapper {

    @Mapping(source = "dependency.id",target = "id")
    @Mapping(source = "dependency.predecessor.phaseId",target = "predecessorId")
    @Mapping(source = "dependency.successor.phaseId",target = "successorId")
    @Mapping(source = "dependency.dependencyType",target = "dependencyType")
    DependencyResponseDTO mapPhaseDependencyToResponse(PhaseDependency dependency);

    List<DependencyResponseDTO> mapPhaseDependenciesToResponse(List<PhaseDependency> dependencies);


    @Mapping(source = "dependency.id",target = "id")
    @Mapping(source = "dependency.predecessor.taskId",target = "predecessorId")
    @Mapping(source = "dependency.successor.taskId",target = "successorId")
    @Mapping(source = "dependency.dependencyType",target = "dependencyType")
    DependencyResponseDTO mapTaskDependencyToResponse(TaskDependency dependency);

    List<DependencyResponseDTO> mapTaskDependenciesToResponse(List<TaskDependency> dependencies);
}
