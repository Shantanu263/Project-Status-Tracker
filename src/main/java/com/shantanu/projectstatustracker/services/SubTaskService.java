package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.models.TaskStatus;
import org.springframework.http.ResponseEntity;

public interface SubTaskService {

    ResponseEntity<Object> getSubTasks(Long projectId, Long phaseId, Long taskId);

    ResponseEntity<Object> getSubTaskById(Long projectId, Long phaseId, Long taskId, Long subTaskId);

    ResponseEntity<Object> createSubTask(Long projectId, Long phaseId, Long taskId, TaskRequestDTO taskRequestDTO);

    ResponseEntity<Object> updateSubTask(Long projectId, Long phaseId, Long taskId, Long subTaskId, TaskRequestDTO dto);

    ResponseEntity<Object> updateSubTaskStatus(Long projectId, Long phaseId, Long taskId, Long subTaskId, TaskStatus taskStatus);

}
