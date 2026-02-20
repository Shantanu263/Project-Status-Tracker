package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.SubTaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.SubTaskResponseDTO;
import com.shantanu.projectstatustracker.models.*;
import org.mapstruct.*;

@Mapper(componentModel = "spring",uses = {CommentMapper.class, ActivityLogMapper.class})
public interface SubTaskMapper {

    @Mapping(source = "subTask.assignedTo.memberId",target = "assignedToProjectMemberId")
    @Mapping(source = "subTask.task.taskId",target = "taskId")
    @Mapping(source = "subTask.comments",target = "comments")
    @Mapping(source = "subTask.logs", target = "logs")
    @Mapping(source = "subTask.completedOn", target = "completedOn")
    SubTaskResponseDTO mapSubTaskToResponse(SubTask subTask);
//
//    List<SubTaskResponseDTO> mapSubTasksToResponse(List<SubTask> subTasks);
//
    @Mapping(source = "task",target = "task")
    @Mapping(source = "assignedTo",target = "assignedTo")
    @Mapping(source = "subTaskRequestDTO.startDate",target = "startDate")
    @Mapping(source = "subTaskRequestDTO.endDate",target = "endDate")
    @Mapping(source = "subTaskRequestDTO.status",target = "status")
    @Mapping(source = "subTaskRequestDTO.priority",target = "priority")
    SubTask mapRequestToSubTask(SubTaskRequestDTO subTaskRequestDTO, Task task, ProjectMember assignedTo);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(source = "assignedTo",target = "subTask.assignedTo")
    void updateSubTaskFromDTO(SubTaskRequestDTO subTaskRequestDTO, ProjectMember assignedTo, @MappingTarget SubTask subTask);

}
