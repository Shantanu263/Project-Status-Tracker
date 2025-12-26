package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.models.Status;
import com.shantanu.projectstatustracker.models.Task;
import org.springframework.http.ResponseEntity;

import java.util.Date;

public interface TaskService {

    ResponseEntity<Object> getPhaseTasks(Long projectId, Long phaseId);

    ResponseEntity<Object> getTaskById(Long projectId, Long phaseId, Long taskId);

    ResponseEntity<Object> createTask(Long projectId, Long phaseId, TaskRequestDTO taskRequestDTO);

    ResponseEntity<Object> updateTask(Long projectId, Long phaseId, Long taskId, TaskRequestDTO dto);

    ResponseEntity<Object> updateTaskStatus(Long projectId, Long phaseId, Long taskId, Status status);

    ResponseEntity<Object> getTasksOfAMember(Long projectId, Long memberId);

    ResponseEntity<Object> updateCompletion(Long projectId, Long phaseId, Long taskId, Date completedAt);

     record TaskSnapshot(
            Long taskId,
            String taskName,
            String description,
            Status status,
            String priority,
            Long assignedToId,
            String assignedToUsername,
            Date startDate,
            Date endDate
    ) {
        public static TaskSnapshot from(Task t) {
            Long assignedId = null;
            String assignedUsername = null;
            if (t.getAssignedTo() != null) {
                assignedId = t.getAssignedTo().getUser().getUserId();
                assignedUsername = t.getAssignedTo().getUser().getName();
            }
            return new TaskSnapshot(
                    t.getTaskId(),
                    t.getTaskName(),
                    t.getDescription(),
                    t.getStatus(),
                    t.getPriority(),
                    assignedId,
                    assignedUsername,
                    t.getStartDate(),
                    t.getEndDate()
            );
        }
    }

}
