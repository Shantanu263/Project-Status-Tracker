package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.PhaseMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.PhaseService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
@Service
public class PhaseServiceImpl implements PhaseService {
    private final ProjectRepo projectRepo;
    private final PhaseRepo phaseRepo;
    private final PhaseMapper phaseMapper;
    private final ProjectMemberRepo projectMemberRepo;
    private final TaskRepo taskRepo;
    private final ActivityLogService activityLogService;
    private final HttpServletRequest request;
    private final ProjectTemplateRepo projectTemplateRepo;

    @Override
    public ResponseEntity<Object> getProjectPhases(Long id) {
        Project project = projectRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        return ResponseEntity.ok(phaseMapper.mapPhasesToPhaseDetailsResponse(phaseRepo.findAllByProject(project)));
    }

    @Override
    public ResponseEntity<Object> addProjectPhase(Long id, PhaseRequestDTO phaseRequestDTO) {
        Project project = projectRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        ProjectMember assignedTo = null;
        if (phaseRequestDTO.getProjectMemberId() != null) {
            assignedTo = projectMemberRepo.findById(phaseRequestDTO.getProjectMemberId()).orElseThrow(() -> new ResourceNotFoundException("Project member not found"));
        }

        Phase phase = phaseMapper.mapRequestToPhase(phaseRequestDTO,project,assignedTo);
        phaseRepo.save(phase);
        
        // Update project progress after adding a new phase
        updateProjectProgress(id);

        activityLogService.log(
                phase.getProject().getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " created new Phase " + phaseRequestDTO.getPhaseName(),
                EntityType.PHASE,
                phase.getPhaseId()
        );

        return ResponseEntity.ok(phase);
    }

    @Override
    public ResponseEntity<Object> getProjectPhaseByPhaseId(Long projectId, Long phaseId) {
        if (!projectRepo.existsById(projectId)) return ResponseEntity.ok(Map.of("message","Project not found"));
        if (!phaseRepo.existsById(phaseId)) return ResponseEntity.ok(Map.of("message","Project Phase not found"));

        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId).orElseThrow(() -> new ResourceNotFoundException("Phase not found"));
        return ResponseEntity.ok(phaseMapper.mapPhaseToPhaseDetailsResponse(phase));
    }

    @Override
    public ResponseEntity<Object> updateProjectPhase(Long projectId, Long phaseId, PhaseRequestDTO phaseRequestDTO) {
        if (!projectRepo.existsById(projectId)) return ResponseEntity.ok(Map.of("message","Project not found"));
        if (!phaseRepo.existsById(phaseId)) return ResponseEntity.ok(Map.of("message","Project Phase not found"));

        ProjectMember assignedTo = null;

        if (phaseRequestDTO.getProjectMemberId() != null) {
            assignedTo = projectMemberRepo.findById(phaseRequestDTO.getProjectMemberId())
                    .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));
        }

        Phase existingPhase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId).orElseThrow(() -> new ResourceNotFoundException("Phase not found"));
        phaseMapper.updatePhaseFromDTO(phaseRequestDTO,assignedTo,existingPhase);

        phaseRepo.save(existingPhase);
        
        // Update phase progress after updating a phase
        updatePhaseProgress(phaseId);

        activityLogService.log(
                existingPhase.getProject().getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " updated Phase Details of " + phaseRequestDTO.getPhaseName(),
                EntityType.PHASE,
                existingPhase.getPhaseId()
        );

        return ResponseEntity.ok(Map.of("message","Phase updated","update phase",phaseMapper.mapPhaseToPhaseDetailsResponse(existingPhase)));
    }

    @Override
    @Transactional
    public ResponseEntity<Object> deleteProjectPhase(Long projectId, Long phaseId) {
        Phase phase = phaseRepo.findById(phaseId).orElseThrow(() -> new ResourceNotFoundException("Phase not found"));
        taskRepo.clearTasksPhase(phaseId);
        phaseRepo.deleteById(phaseId);
        
        // Update project progress after deleting a phase
        updateProjectProgress(projectId);

        activityLogService.log(
                phase.getProject().getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " deleted Phase " + phase.getPhaseName(),
                EntityType.PHASE,
                phase.getPhaseId()
        );
        
        return ResponseEntity.ok(Map.of("message", "Phase deleted."));
    }

    @Override
    public ResponseEntity<Object> updatePhaseStatus(Long projectId, Long phaseId, PhaseStatus status) {
        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new RuntimeException("Phase not found"));

        phase.setStatus(status);
        phaseRepo.save(phase);
        
        // Update phase progress after updating its status
        updatePhaseProgress(phaseId);

        return ResponseEntity.ok(Map.of("message","Status updated"));
    }

    @Override
    public ResponseEntity<Object> addPhaseTemplateToProject(Long projectId, Long templateId) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        ProjectTemplate projectTemplate = projectTemplateRepo.findById(templateId)
                .orElseThrow(() -> new ResourceNotFoundException("Template does not exist"));

        project.setProjectTemplate(projectTemplate);

        List<Phase> clonedPhases = projectTemplate.getProjectTemplatePhases().stream().map(templatePhase -> {
            Phase phase = new Phase();
            phase.setPhaseName(templatePhase.getPhaseName());
            phase.setStatus(PhaseStatus.TO_DO);   // Default status
            phase.setStartDate(project.getStartDate()); // start same as project
            phase.setEndDate(project.getEndDate());     // end same as project
            phase.setProject(project);
            return phase;
        }).toList();

        List<Phase> savedPhases = phaseRepo.saveAll(clonedPhases);
        project.setPhases(savedPhases);

        return ResponseEntity.ok(Map.of("message","Template: " +projectTemplate.getTemplateName()+" added successfully"));
    }

    @Override
    public ResponseEntity<Object> updateCompletion(Long projectId, Long phaseId, Date completedAt) {
        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new RuntimeException("Phase not found"));

        phase.setCompletedAt(completedAt);
        phaseRepo.save(phase);

        return ResponseEntity.ok(Map.of("message","Completion updated"));
    }

    @Override
    public Double updatePhaseProgress(Long phaseId) {
        Phase phase = phaseRepo.findById(phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));
        
        List<Task> tasks = taskRepo.findByProjectPhase_PhaseId(phaseId);
        
        if (tasks.isEmpty()) {
            phase.setProgress(0.0);
            phaseRepo.save(phase);
            return 0.0;
        }
        
        long completedTasks = tasks.stream()
                .filter(task -> TaskStatus.DONE.equals(task.getStatus()))
                .count();
        
        Double progress = (double) completedTasks / tasks.size() * 100;
        phase.setProgress(progress);
        phaseRepo.save(phase);
        
        // Update the project progress after updating the phase progress
        updateProjectProgress(phase.getProject().getProjectId());
        
        return progress;
    }
    

    public Double updateProjectProgress(Long projectId) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        
        List<Phase> phases = phaseRepo.findAllByProject_ProjectId(projectId);
        
        if (phases.isEmpty()) {
            project.setProgress(0.0);
            projectRepo.save(project);
            return 0.0;
        }
        
        Double totalProgress = phases.stream()
                .mapToDouble(Phase::getProgress)
                .sum();
        
        Double averageProgress = totalProgress / phases.size();
        project.setProgress(averageProgress);
        projectRepo.save(project);

        return averageProgress;
    }
}
