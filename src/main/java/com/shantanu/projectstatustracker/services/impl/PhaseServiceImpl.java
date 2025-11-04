package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.PhaseMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.Task;
import com.shantanu.projectstatustracker.repositories.PhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectMemberRepo;
import com.shantanu.projectstatustracker.repositories.ProjectRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.services.PhaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

        ProjectMember assignedTo = projectMemberRepo.findById(phaseRequestDTO.getProjectMemberId()).orElseThrow();

        phaseRepo.save(phaseMapper.mapRequestToPhase(phaseRequestDTO,project,assignedTo));

        return ResponseEntity.ok(Map.of("message","Project Phase Added"));
    }

    @Override
    public ResponseEntity<Object> getProjectPhaseByPhaseId(Long projectId, Long phaseId) {
        if (!projectRepo.existsById(projectId)) return ResponseEntity.ok(Map.of("message","Project not found"));
        if (!phaseRepo.existsById(phaseId)) return ResponseEntity.ok(Map.of("message","Project Phase not found"));

        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId).orElseThrow(() -> new ResourceNotFoundException("Phase not found"));
        return ResponseEntity.ok(phase);
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

        return ResponseEntity.ok(Map.of("message","Phase updated","update phase",existingPhase));
    }

    @Override
    @Transactional
    public ResponseEntity<Object> deleteProjectPhase(Long projectId, Long phaseId) {
        taskRepo.clearTasksPhase(phaseId);
        phaseRepo.deleteById(phaseId);
        return ResponseEntity.ok("Phase deleted.");
    }

    @Override
    public ResponseEntity<Object> updatePhaseStatus(Long projectId, Long phaseId, String status) {
        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId, projectId)
                .orElseThrow(() -> new RuntimeException("Phase not found"));

        phase.setStatus(String.valueOf(status));
        phaseRepo.save(phase);

        return ResponseEntity.ok("Status updated");
    }

}
