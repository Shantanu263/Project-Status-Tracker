package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.TaskMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.Status;
import com.shantanu.projectstatustracker.models.Task;
import com.shantanu.projectstatustracker.repositories.PhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectMemberRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.TaskService;
import com.sun.source.util.TaskListener;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

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

    @Override
    public ResponseEntity<Object> getPhaseTasks(Long projectId, Long phaseId) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        List<Task> tasks = taskRepo.findByProjectPhase_PhaseId(phaseId);
        return ResponseEntity.ok(tasks);
    }

    @Override
    public ResponseEntity<Object> getTaskById(Long projectId, Long phaseId, Long taskId) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found."));

        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        return ResponseEntity.ok(task);
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


        return ResponseEntity.ok(Map.of("message","New Task Created","new task",task));
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

        return ResponseEntity.ok(Map.of("message","Task updated","update Task",existingTask));
    }

    @Override
    public ResponseEntity<Object> updateTaskStatus(Long projectId, Long phaseId, Long taskId, Status status) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        Task existingTask = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        existingTask.setStatus(status);
        taskRepo.save(existingTask);
        
        // Update phase progress with respect to Task Status
        phaseService.updatePhaseProgress(phaseId);

        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " changed Task status of " + existingTask.getTaskName() + " to " + status
        );

        return ResponseEntity.ok(Map.of("message","Task status updated","updated Task",existingTask));
    }
}
