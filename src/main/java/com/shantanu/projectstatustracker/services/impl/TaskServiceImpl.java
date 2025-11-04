package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.TaskMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.Task;
import com.shantanu.projectstatustracker.repositories.PhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectMemberRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.services.TaskService;
import com.sun.source.util.TaskListener;
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

        return ResponseEntity.ok(Map.of("message","Task updated","update Task",existingTask));
    }

}
