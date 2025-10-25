package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.PhaseMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.repositories.PhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectRepo;
import com.shantanu.projectstatustracker.services.PhaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.Map;

@RequiredArgsConstructor
@Service
public class PhaseServiceImpl implements PhaseService {
    private final ProjectRepo projectRepo;
    private final PhaseRepo phaseRepo;
    private final PhaseMapper phaseMapper;

    @Override
    public ResponseEntity<Object> getProjectPhases(Long id) {
        Project project = projectRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        return ResponseEntity.ok(phaseRepo.findAllByProject(project));
    }

    @Override
    public ResponseEntity<Object> addProjectPhase(Long id, PhaseRequestDTO phaseRequestDTO) {
        Project project = projectRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        phaseRepo.save(phaseMapper.mapRequestToPhase(phaseRequestDTO,project));

        return ResponseEntity.ok(Map.of("message","Project Phase Added"));
    }

    @Override
    public ResponseEntity<Object> getProjectPhaseByPhaseId(Long projectId, Long phaseId) {
        if (!projectRepo.existsById(projectId)) return ResponseEntity.ok(Map.of("message","Project not found"));
        if (!phaseRepo.existsById(phaseId)) return ResponseEntity.ok(Map.of("message","Project Phase not found"));

        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId);
        return ResponseEntity.ok(phase);
    }

}
