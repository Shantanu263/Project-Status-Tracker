package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.models.DependencyType;
import com.shantanu.projectstatustracker.models.PhaseStatus;
import org.springframework.http.ResponseEntity;

import java.util.Date;
import java.util.List;

public interface PhaseService {

    ResponseEntity<Object> getProjectPhases(Long id);

    ResponseEntity<Object> addProjectPhase(Long id, PhaseRequestDTO phaseRequestDTO);

    ResponseEntity<Object> getProjectPhaseByPhaseId(Long projectId,Long phaseId);

    ResponseEntity<Object> updateProjectPhase(Long projectId, Long phaseId, PhaseRequestDTO phaseRequestDTO);

    ResponseEntity<Object> deleteProjectPhase(Long projectId,Long phaseId);

    ResponseEntity<Object> updatePhaseStatus(Long projectId, Long phaseId, PhaseStatus status);

    ResponseEntity<Object> addPhaseTemplateToProject(Long projectId, Long templateId);

    ResponseEntity<Object> updateCompletion(Long projectId, Long phaseId, Date completedAt);

    Double updatePhaseProgress(Long phaseId);

    ResponseEntity<Object> createDependency(Long predecessorId, Long successorId, Long projectId, DependencyType dependencyType);

    ResponseEntity<Object> deleteDependency(Long projectId, Long dependencyId);

    ResponseEntity<Object> getPhaseDependencies(Long projectId);

    ResponseEntity<Object> updatePhaseDependencyType(Long projectId, Long dependencyId, DependencyType newDependencyType);

    ResponseEntity<Object> bulkUpdate(Long projectId, List<Long> ids, PhaseRequestDTO updates);

    ResponseEntity<Object> bulkDelete(Long projectId, List<Long> ids);
}
