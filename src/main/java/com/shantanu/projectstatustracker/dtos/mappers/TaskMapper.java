package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.TaskResponseDTO;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.Task;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring", uses = {CommentMapper.class, ActivityLogMapper.class, SubTaskMapper.class})
public interface TaskMapper {

    @Mapping(source = "phase",target = "projectPhase")
    @Mapping(source = "assignedTo",target = "assignedTo")
    @Mapping(source = "taskRequestDTO.description",target = "description")
    @Mapping(source = "taskRequestDTO.startDate",target = "startDate")
    @Mapping(source = "taskRequestDTO.endDate",target = "endDate")
    @Mapping(source = "taskRequestDTO.status",target = "status")
    @Mapping(source = "taskRequestDTO.priority",target = "priority")
    Task mapTaskRequestDTOToTask(TaskRequestDTO taskRequestDTO, Phase phase, ProjectMember assignedTo);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(source = "assignedTo",target = "task.assignedTo")
    void updateTaskFromDTO(TaskRequestDTO taskRequestDTO, ProjectMember assignedTo, @MappingTarget Task task);

    @Mapping(source = "task.assignedTo.memberId",target = "assignedToProjectMemberId")
    @Mapping(source = "task.projectPhase.phaseId",target = "projectPhaseId")
    @Mapping(source = "task.logs", target = "logs")
    @Mapping(source = "task.subTasks", target = "subTasks")
    @Mapping(source = "task.progress", target = "progress")
    @Mapping(source = "task.completedAt", target = "completedOn")
    TaskResponseDTO mapTaskToResponse(Task task);

    @Mapping(source = "task.assignedTo.memberId",target = "assignedToProjectMemberId")
    @Mapping(source = "task.projectPhase.phaseId",target = "projectPhaseId")
    List<TaskResponseDTO> mapTasksToResponse(List<Task> tasks);

}
