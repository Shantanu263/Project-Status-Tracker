package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.PhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectMemberRepo;
import com.shantanu.projectstatustracker.repositories.SubTaskRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.SubTaskService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Service
public class SubTaskServiceImpl implements SubTaskService {

    private final SubTaskRepo subTaskRepo;
    private final TaskRepo taskRepo;
    private final PhaseRepo phaseRepo;
    private final ProjectMemberRepo projectMemberRepo;
    private final HttpServletRequest request;
    private final ActivityLogService activityLogService;

    @Override
    public ResponseEntity<Object> getSubTasks(Long projectId, Long phaseId, Long taskId) {
        // Verify phase exists in the project
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        // Verify task exists in the phase
        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // Get all subtasks for the task
        List<SubTask> subTasks = task.getSubTasks();
        
        // Map subtasks to response DTOs
        List<Map<String, Object>> response = subTasks.stream()
                .map(this::mapSubTaskToResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    @Override
    public ResponseEntity<Object> getSubTaskById(Long projectId, Long phaseId, Long taskId, Long subTaskId) {
        // Verify phase exists in the project
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        // Verify task exists in the phase
        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // Find the subtask
        SubTask subTask = subTaskRepo.findById(subTaskId)
                .orElseThrow(() -> new ResourceNotFoundException("SubTask not found"));

        // Verify subtask belongs to the task
        if (!subTask.getTask().getTaskId().equals(taskId)) {
            return new ResponseEntity<>(Map.of("message", "SubTask does not belong to the specified task"), 
                    HttpStatus.BAD_REQUEST);
        }

        return ResponseEntity.ok(mapSubTaskToResponse(subTask));
    }

    @Override
    public ResponseEntity<Object> createSubTask(Long projectId, Long phaseId, Long taskId, TaskRequestDTO taskRequestDTO) {
        // Verify phase exists in the project
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        // Verify task exists in the phase
        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // Find assigned member if provided
        ProjectMember assignedTo = null;
        if (taskRequestDTO.getAssignedTo() != null) {
            assignedTo = projectMemberRepo.findById(taskRequestDTO.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project Member not found"));
        }

        // Create and save the subtask
        SubTask subTask = SubTask.builder()
                .subTaskName(taskRequestDTO.getTaskName())
                .task(task)
                .startDate(taskRequestDTO.getStartDate())
                .endDate(taskRequestDTO.getEndDate())
                .status(taskRequestDTO.getStatus())
                .priority(taskRequestDTO.getPriority())
                .assignedTo(assignedTo)
                .build();

        subTaskRepo.save(subTask);

        // Log the activity
        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " created new SubTask " + taskRequestDTO.getTaskName(),
                EntityType.SUBTASK,
                subTask.getSubTaskId()
        );

        return ResponseEntity.ok(mapSubTaskToResponse(subTask));
    }

    @Override
    public ResponseEntity<Object> updateSubTask(Long projectId, Long phaseId, Long taskId, Long subTaskId, TaskRequestDTO dto) {
        // Verify phase exists in the project
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        // Verify task exists in the phase
        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // Find the subtask
        SubTask existingSubTask = subTaskRepo.findById(subTaskId)
                .orElseThrow(() -> new ResourceNotFoundException("SubTask not found"));

        // Verify subtask belongs to the task
        if (!existingSubTask.getTask().getTaskId().equals(taskId)) {
            return new ResponseEntity<>(Map.of("message", "SubTask does not belong to the specified task"), 
                    HttpStatus.BAD_REQUEST);
        }

        // Find assigned member if provided
        ProjectMember assignedTo = null;
        if (dto.getAssignedTo() != null) {
            assignedTo = projectMemberRepo.findById(dto.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project Member not found"));
        }

        // Update the subtask
        if (dto.getTaskName() != null) {
            existingSubTask.setSubTaskName(dto.getTaskName());
        }
        if (dto.getStartDate() != null) {
            existingSubTask.setStartDate(dto.getStartDate());
        }
        if (dto.getEndDate() != null) {
            existingSubTask.setEndDate(dto.getEndDate());
        }
        if (dto.getStatus() != null) {
            existingSubTask.setStatus(dto.getStatus());
        }
        if (dto.getPriority() != null) {
            existingSubTask.setPriority(dto.getPriority());
        }
        if (assignedTo != null) {
            existingSubTask.setAssignedTo(assignedTo);
        }

        subTaskRepo.save(existingSubTask);

        // Log the activity
        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " updated SubTask Details of " + existingSubTask.getSubTaskName(),
                EntityType.SUBTASK,
                existingSubTask.getSubTaskId()
        );

        return ResponseEntity.ok(Map.of(
                "message", "SubTask updated",
                "updated SubTask", mapSubTaskToResponse(existingSubTask)
        ));
    }

    @Override
    public ResponseEntity<Object> updateSubTaskStatus(Long projectId, Long phaseId, Long taskId, Long subTaskId, TaskStatus status) {
        // Verify phase exists in the project
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        // Verify task exists in the phase
        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        // Find the subtask
        SubTask existingSubTask = subTaskRepo.findById(subTaskId)
                .orElseThrow(() -> new ResourceNotFoundException("SubTask not found"));

        // Verify subtask belongs to the task
        if (!existingSubTask.getTask().getTaskId().equals(taskId)) {
            return new ResponseEntity<>(Map.of("message", "SubTask does not belong to the specified task"), 
                    HttpStatus.BAD_REQUEST);
        }

        // Check if the user is authorized to update the status
        ProjectMember member = projectMemberRepo.findByProject_ProjectIdAndUser_Email(
                projectId, (String) request.getAttribute("email"));

        if (member.getRole() == ProjectRole.PROJECT_HANDLER && 
                existingSubTask.getAssignedTo() != null && 
                !existingSubTask.getAssignedTo().equals(member)) {
            return new ResponseEntity<>(
                    Map.of("message", "This subtask is assigned to another user."), 
                    HttpStatus.BAD_REQUEST
            );
        }

        // Update the status
        existingSubTask.setStatus(status);
        subTaskRepo.save(existingSubTask);

        // Log the activity
        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " changed SubTask status of " + 
                        existingSubTask.getSubTaskName() + " to " + status,
                EntityType.SUBTASK,
                existingSubTask.getSubTaskId()
        );

        return ResponseEntity.ok(Map.of(
                "message", "SubTask status updated",
                "updated SubTask", mapSubTaskToResponse(existingSubTask)
        ));
    }

    // Helper method to map SubTask to response object
    private Map<String, Object> mapSubTaskToResponse(SubTask subTask) {
        Map<String, Object> response = new HashMap<>();
        response.put("subTaskId", subTask.getSubTaskId());
        response.put("subTaskName", subTask.getSubTaskName());
        response.put("taskId", subTask.getTask().getTaskId());
        response.put("startDate", subTask.getStartDate());
        response.put("endDate", subTask.getEndDate());
        response.put("status", subTask.getStatus());
        response.put("priority", subTask.getPriority());
        
        if (subTask.getAssignedTo() != null) {
            response.put("assignedToProjectMemberId", subTask.getAssignedTo().getMemberId());
        }
        
        return response;
    }
}
