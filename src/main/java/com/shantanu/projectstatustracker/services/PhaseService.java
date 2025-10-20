package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import org.springframework.http.ResponseEntity;

public interface PhaseService {

    ResponseEntity<Object> getProjectPhases(Long id);

    ResponseEntity<Object> addProjectPhase(Long id, PhaseRequestDTO phaseRequestDTO);
}
