package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.FailedItem;
import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.DependencyMapper;
import com.shantanu.projectstatustracker.dtos.mappers.PhaseMapper;
import com.shantanu.projectstatustracker.dtos.BulkUpdateResponseDTO;
import com.shantanu.projectstatustracker.exceptions.SchedulingConstraintException;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.PhaseService;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;

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
    private final DependencyEngine<Phase> dependencyEngine;
    private final PhaseDependencyRepo dependencyRepository;
    private final DependencyMapper dependencyMapper;
    private final PlatformTransactionManager transactionManager;
    private final TransactionTemplate transactionTemplate;

    @PostConstruct
    public void init() {
        TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
        transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

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
        try {
            Phase updatedPhase = updateProjectPhaseInternal(projectId, phaseId, phaseRequestDTO);

            return ResponseEntity.ok(Map.of(
                    "message", "Phase updated",
                    "updated Phase", phaseMapper.mapPhaseToPhaseDetailsResponse(updatedPhase)
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
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

        if (status.equals(PhaseStatus.COMPLETED)) phase.setCompletedOn(new Date());
        else phase.setCompletedOn(null);

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
            phase.setStatus(PhaseStatus.OPEN);   // Default status
            phase.setStartDate(project.getStartDate()); // start same as a project
            phase.setEndDate(project.getEndDate());     // end same as a project
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

        phase.setCompletedOn(completedAt);
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
                .filter(task -> Status.COMPLETED.equals(task.getStatus()))
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

    @Override
    public ResponseEntity<Object> createDependency(Long predecessorId, Long successorId, Long projectId, DependencyType dependencyType) {

        Phase predecessor = phaseRepo.findById(predecessorId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        Phase successor = phaseRepo.findById(successorId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        // Default to FS if not provided
        if (dependencyType == null) {
            dependencyType = DependencyType.FS;
        }

        if (predecessor.getPhaseId().equals(successor.getPhaseId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "A phase cannot depend on itself"));
        }

        if (dependencyRepository.existsByPredecessorAndSuccessor(predecessor, successor)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Dependency already exists"));
        }

        boolean cycle = dependencyEngine.createsCycle(
                predecessor,
                successor,
                phase -> dependencyRepository
                        .findByPredecessor(phase)
                        .stream()
                        .map(PhaseDependency::getSuccessor)
                        .toList()
        );

        if (cycle) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Circular dependency detected"));
        }

        // Align successor dates to satisfy the new constraint
        dependencyEngine.adjustDates(predecessor, successor, dependencyType);
        phaseRepo.save(successor);

        PhaseDependency dependency = new PhaseDependency();
        dependency.setPredecessor(predecessor);
        dependency.setSuccessor(successor);
        dependency.setDependencyType(dependencyType);
        dependency.setProject(project);

        dependencyRepository.save(dependency);
        return ResponseEntity.ok(Map.of("message","Dependency created successfully"));
    }

    @Override
    public ResponseEntity<Object> deleteDependency(Long projectId, Long dependencyId) {
        PhaseDependency dependency = dependencyRepository.findByIdAndProject_ProjectId(dependencyId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Dependency not found"));
        dependencyRepository.delete(dependency);
        return ResponseEntity.ok(Map.of("message","Dependency deleted successfully"));
    }

    @Override
    public ResponseEntity<Object> getPhaseDependencies(Long projectId) {
        List<PhaseDependency> dependencies = dependencyRepository.findByProject_ProjectId(projectId);

        return ResponseEntity.ok(dependencyMapper.mapPhaseDependenciesToResponse(dependencies));
    }

    @Override
    public ResponseEntity<Object> updatePhaseDependencyType(Long projectId, Long dependencyId, DependencyType newDependencyType) {
        PhaseDependency dependency = dependencyRepository.findByIdAndProject_ProjectId(dependencyId, projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Dependency not found"));

        dependency.setDependencyType(newDependencyType);

        Phase predecessor = dependency.getPredecessor();
        Phase successor   = dependency.getSuccessor();

        // Re-align successor dates according to the new dependency type
        dependencyEngine.adjustDates(predecessor, successor, newDependencyType);
        phaseRepo.save(successor);

        dependencyRepository.save(dependency);

        // Propagate any cascading adjustments from the successor onward
        dependencyEngine.propagateAdjustments(
                successor,
                dependencyRepository::findByPredecessor,
                (dep, ignored) -> dep.getSuccessor(),
                (dep, ignored) -> dep.getDependencyType(),
                phaseRepo::save
        );

        return ResponseEntity.ok(Map.of("message", "Dependency type updated successfully"));
    }

    @Override
    public ResponseEntity<Object> bulkUpdate(Long projectId, List<Long> ids, PhaseRequestDTO updates) {
        BulkUpdateResponseDTO result = new BulkUpdateResponseDTO();

        for (Long phaseId : ids) {
            try {
                phaseRepo.findById(phaseId).orElseThrow(()  -> new Exception("Phase not found"));
                transactionTemplate.executeWithoutResult(status -> {
                    try {
                        updateProjectPhaseInternal(projectId, phaseId, updates);
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                });
                result.getSuccessIds().add(phaseId);

            } catch (Exception e) {
                result.getFailedItems().add(
                        new FailedItem(phaseId, e.getMessage())
                );
            }
        }

        return ResponseEntity.ok(result);
    }

    @Override
    @Transactional
    public ResponseEntity<Object> bulkDelete(Long projectId, List<Long> ids) {
        List<Phase> phases = phaseRepo.findAllById(ids);

        for (Phase phase : phases) {
            phaseRepo.delete(phase);
            taskRepo.clearTasksPhase(phase.getId());

            activityLogService.log(
                    projectId,
                    (String) request.getAttribute("email"),
                    request.getAttribute("username") + " deleted Phase " + phase.getPhaseName(),
                    EntityType.PHASE,
                    phase.getPhaseId()
            );
        }
        updateProjectProgress(projectId);
        return ResponseEntity.ok(Map.of("message", "Phases deleted successfully"));
    }

    public Phase updateProjectPhaseInternal(Long projectId, Long phaseId, PhaseRequestDTO phaseRequestDTO) throws Exception {
        if (!projectRepo.existsById(projectId)) throw new Exception("Project not found");
        if (!phaseRepo.existsById(phaseId)) throw new Exception("Phase not found");

        ProjectMember assignedTo = null;

        if (phaseRequestDTO.getProjectMemberId() != null) {
            assignedTo = projectMemberRepo.findById(phaseRequestDTO.getProjectMemberId())
                    .orElseThrow(() -> new Exception("Project member not found"));
        }

        Phase existingPhase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId).orElseThrow(() -> new Exception("Phase not found"));

        TaskServiceImpl.validateDate(phaseRequestDTO.getStartDate(), existingPhase.getStartDate(), phaseRequestDTO.getEndDate(), existingPhase.getEndDate());


        phaseMapper.updatePhaseFromDTO(phaseRequestDTO,assignedTo,existingPhase);

        //Update completion date is status is changed
        if (phaseRequestDTO.getStatus()!= null) {
            if (phaseRequestDTO.getStatus().equals(PhaseStatus.COMPLETED)) existingPhase.setCompletedOn(new Date());
            else existingPhase.setCompletedOn(null);
        }

        // --- Scheduling constraint check against predecessors ---
        // If the user has changed dates, verify the new dates don't violate any
        // incoming dependency constraints (i.e., this phase acting as a successor).
        if (phaseRequestDTO.getStartDate() != null || phaseRequestDTO.getEndDate() != null) {
            List<PhaseDependency> incomingDeps = dependencyRepository.findBySuccessor(existingPhase);
            for (PhaseDependency dep : incomingDeps) {
                try {
                    dependencyEngine.checkConstraint(dep.getPredecessor(), existingPhase, dep.getDependencyType());
                } catch (SchedulingConstraintException e) {
                    throw new Exception(e.getMessage());
                }
            }
        }

        phaseRepo.save(existingPhase);

        // --- Propagate scheduling adjustments to successors ---
        // If this phase's dates changed, shift any successors whose constraints
        // are now violated (transitively).
        if (phaseRequestDTO.getStartDate() != null || phaseRequestDTO.getEndDate() != null) {
            dependencyEngine.propagateAdjustments(
                    existingPhase,
                    dependencyRepository::findByPredecessor,
                    (dep, ignored) -> dep.getSuccessor(),
                    (dep, ignored) -> dep.getDependencyType(),
                    phaseRepo::save
            );
        }

        // Update phase progress after updating a phase
        updatePhaseProgress(phaseId);

        activityLogService.log(
                existingPhase.getProject().getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " updated Phase Details of " + phaseRequestDTO.getPhaseName(),
                EntityType.PHASE,
                existingPhase.getPhaseId()
        );

        return existingPhase;
    }

}
