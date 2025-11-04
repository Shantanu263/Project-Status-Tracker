package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import org.springframework.http.ResponseEntity;

public interface PhaseService {

    ResponseEntity<Object> getProjectPhases(Long id);

    ResponseEntity<Object> addProjectPhase(Long id, PhaseRequestDTO phaseRequestDTO);

    ResponseEntity<Object> getProjectPhaseByPhaseId(Long projectId,Long phaseId);

    ResponseEntity<Object> updateProjectPhase(Long projectId, Long phaseId, PhaseRequestDTO phaseRequestDTO);

    ResponseEntity<Object> deleteProjectPhase(Long projectId,Long phaseId);

    ResponseEntity<Object> updatePhaseStatus(Long projectId, Long phaseId, String status);


}
