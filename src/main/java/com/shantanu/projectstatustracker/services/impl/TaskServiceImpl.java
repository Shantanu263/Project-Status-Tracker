package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.TaskMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.PhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectMemberRepo;
import com.shantanu.projectstatustracker.repositories.ProjectRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@Service
public class TaskServiceImpl implements TaskService {

    private final TaskRepo taskRepo;
    private final PhaseRepo phaseRepo;
    private final TaskMapper taskMapper;
    private final ProjectMemberRepo projectMemberRepo;
    private final PhaseServiceImpl phaseService;
    private final HttpServletRequest request;
    private final ActivityLogService activityLogService;
    private final ProjectRepo projectRepo;

    @Override
    public ResponseEntity<Object> getPhaseTasks(Long projectId, Long phaseId) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        List<Task> tasks = taskRepo.findByProjectPhase_PhaseId(phaseId);
        return ResponseEntity.ok(taskMapper.mapTasksToResponse(tasks));
    }

    @Override
    public ResponseEntity<Object> getTaskById(Long projectId, Long phaseId, Long taskId) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found."));

        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        return ResponseEntity.ok(taskMapper.mapTaskToResponse(task));
    }

    @Override
    public ResponseEntity<Object> createTask(Long projectId, Long phaseId, TaskRequestDTO taskRequestDTO) {
        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        ProjectMember assignedTo = null;

        if (taskRequestDTO.getAssignedTo() != null){
             assignedTo = projectMemberRepo.findById(taskRequestDTO.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project Member not found"));
        }

        Task task = taskMapper.mapTaskRequestDTOToTask(taskRequestDTO,phase,assignedTo);
        taskRepo.save(task);
        
        // Update phase progress after creating a task
        phaseService.updatePhaseProgress(phaseId);

        activityLogService.log(
                phase.getProject().getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " created new Task " + taskRequestDTO.getTaskName()
        );

        //causing problems
        //return ResponseEntity.ok(Map.of("message","New Task Created","new task",task));
        return ResponseEntity.ok(task);
    }

    @Override
    public ResponseEntity<Object> updateTask(Long projectId, Long phaseId, Long taskId, TaskRequestDTO dto) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        ProjectMember assignedTo = null;

        if (dto.getAssignedTo() != null) {
            assignedTo = projectMemberRepo.findById(dto.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));
        }

        Task existingTask = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId).orElseThrow();

        taskMapper.updateTaskFromDTO(dto,assignedTo,existingTask);

        taskRepo.save(existingTask);
        
        // Update phase progress with respect to Task Status
        phaseService.updatePhaseProgress(phaseId);

        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " updated Task Details of " + existingTask.getTaskName()
        );

        return ResponseEntity.ok(Map.of("message","Task updated","update Task",taskMapper.mapTaskToResponse(existingTask)));
    }

    @Override
    public ResponseEntity<Object> updateTaskStatus(Long projectId, Long phaseId, Long taskId, Status status) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        Task existingTask = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        ProjectMember member = projectMemberRepo.findByProject_ProjectIdAndUser_Email(projectId,(String) request.getAttribute("email"));

        if (member.getRole() == ProjectRole.PROJECT_HANDLER && existingTask.getAssignedTo() != member) {
            return new ResponseEntity<>(Map.of("message", "This task is assigned to other user."), HttpStatus.BAD_REQUEST);
        }

        existingTask.setStatus(status);
        taskRepo.save(existingTask);
        
        // Update phase progress with respect to Task Status
        phaseService.updatePhaseProgress(phaseId);

        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " changed Task status of " + existingTask.getTaskName() + " to " + status
        );

        return ResponseEntity.ok(Map.of("message","Task status updated","updated Task",taskMapper.mapTaskToResponse(existingTask)));
    }

    @Override
    public ResponseEntity<Object> getTasksOfAMember(Long projectId, Long memberId) {
        if (!projectRepo.existsById(projectId)) return new ResponseEntity<>(Map.of("message", "Project not found"),HttpStatus.NOT_FOUND);
        if (!projectMemberRepo.existsById(memberId)) return new ResponseEntity<>(Map.of("message", "Project Member not found"),HttpStatus.NOT_FOUND);

        return ResponseEntity.ok(taskMapper.mapTasksToResponse(taskRepo.findByAssignedTo_MemberId(memberId)));
    }

    @Override
    public ResponseEntity<Object> updateCompletion(Long projectId, Long phaseId, Long taskId, Date completedAt) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        Task existingTask = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        ProjectMember member = projectMemberRepo.findByProject_ProjectIdAndUser_Email(projectId,(String) request.getAttribute("email"));

        if (member.getRole() == ProjectRole.PROJECT_HANDLER && existingTask.getAssignedTo() != member) {
            return new ResponseEntity<>(Map.of("message", "This task is assigned to other user."), HttpStatus.BAD_REQUEST);
        }

        existingTask.setCompletedAt(completedAt);
        taskRepo.save(existingTask);

        return ResponseEntity.ok(Map.of("message","Completion updated"));
    }

}
