package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;

public interface TaskService {
    ResponseEntity<Object> getPhaseTasks(Long projectId, Long phaseId);

    ResponseEntity<Object> getTaskById(Long projectId, Long phaseId, Long taskId);

    ResponseEntity<Object> createTask(Long projectId, Long phaseId, TaskRequestDTO taskRequestDTO);

    ResponseEntity<Object> updateTask(Long projectId, Long phaseId, Long taskId, TaskRequestDTO dto);
}
