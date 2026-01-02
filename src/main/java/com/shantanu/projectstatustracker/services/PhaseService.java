package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import org.springframework.http.ResponseEntity;

import java.util.Date;

public interface PhaseService {

    ResponseEntity<Object> getProjectPhases(Long id);

    ResponseEntity<Object> addProjectPhase(Long id, PhaseRequestDTO phaseRequestDTO);

    ResponseEntity<Object> getProjectPhaseByPhaseId(Long projectId,Long phaseId);

    ResponseEntity<Object> updateProjectPhase(Long projectId, Long phaseId, PhaseRequestDTO phaseRequestDTO);

    ResponseEntity<Object> deleteProjectPhase(Long projectId,Long phaseId);

    ResponseEntity<Object> updatePhaseStatus(Long projectId, Long phaseId, String status);

    ResponseEntity<Object> addPhaseTemplateToProject(Long projectId, Long templateId);

    ResponseEntity<Object> updateCompletion(Long projectId, Long phaseId, Date completedAt);

    Double updatePhaseProgress(Long phaseId);
}
