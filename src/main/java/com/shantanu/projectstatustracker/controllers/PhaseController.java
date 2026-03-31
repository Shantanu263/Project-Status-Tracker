package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.BulkUpdateRequestDTO;
import com.shantanu.projectstatustracker.dtos.DependencyRequestDTO;
import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.models.DependencyType;
import com.shantanu.projectstatustracker.models.PhaseStatus;
import com.shantanu.projectstatustracker.services.PhaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Date;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api")
public class PhaseController {
    private final PhaseService phaseService;

    @GetMapping("/project/{id}/phases")
    public ResponseEntity<Object> getProjectPhases(@PathVariable(name = "id") Long id){
        return phaseService.getProjectPhases(id);
    }

    @GetMapping("/project/{projectId}/phase/{phaseId}")
    public ResponseEntity<Object> getProjectPhaseByPhaseId(@PathVariable(name = "projectId") Long projectId,
                                                           @PathVariable(name = "phaseId") Long phaseId){
        return phaseService.getProjectPhaseByPhaseId(projectId,phaseId);

    }

    @PostMapping("/project/{projectId}/phases/template/{templateId}")
    public ResponseEntity<Object> addPhaseTemplateToProject(@PathVariable(name = "projectId") Long projectId,
                                                            @PathVariable(name = "templateId") Long templateId){
        return phaseService.addPhaseTemplateToProject(projectId,templateId);
    }

    @PostMapping("/project/{id}/phases")
    public ResponseEntity<Object> addProjectPhase(@PathVariable(name = "id") Long id,
                                                  @RequestBody PhaseRequestDTO phaseRequestDTO){
        return phaseService.addProjectPhase(id,phaseRequestDTO);
    }

    @PutMapping("/project/{projectId}/phase/{phaseId}")
    public ResponseEntity<Object> updateProjectPhase(@PathVariable(name = "projectId") Long projectId,
                                                     @PathVariable(name = "phaseId") Long phaseId,
                                                     @RequestBody PhaseRequestDTO phaseRequestDTO){
        return phaseService.updateProjectPhase(projectId,phaseId,phaseRequestDTO);
    }

    @DeleteMapping("/project/{projectId}/phase/{phaseId}")
    public ResponseEntity<Object> deleteProjectPhase(@PathVariable(name = "projectId") Long projectId,
                                                     @PathVariable(name = "phaseId") Long phaseId){
        return phaseService.deleteProjectPhase(projectId,phaseId);

    }

    @PatchMapping("/project/{projectId}/phase/{phaseId}/status")
    public ResponseEntity<Object> updateStatus(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @RequestParam(name = "status") PhaseStatus status) {
        return phaseService.updatePhaseStatus(projectId, phaseId, status);
    }

    @PatchMapping("/project/{projectId}/phase/{phaseId}/completed")
    public ResponseEntity<Object> updateCompletion(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @RequestParam(name = "completedAt") Date completedAt) {
        return phaseService.updateCompletion(projectId, phaseId, completedAt);
    }

    @GetMapping("/project/{projectId}/phases/dependency")
    public ResponseEntity<Object> getPhaseDependencies(@PathVariable Long projectId){
        return phaseService.getPhaseDependencies(projectId);
    }

    @PostMapping("/project/{projectId}/phases/dependency")
    public ResponseEntity<Object> createPhaseDependency(@PathVariable Long projectId,
                                                        @RequestBody DependencyRequestDTO dto){
        return phaseService.createDependency(dto.getPredecessorId(), dto.getSuccessorId(), projectId, dto.getDependencyType());
    }

    @DeleteMapping("/project/{projectId}/phases/dependency/{dependencyId}")
    public ResponseEntity<Object> deletePhaseDependency(@PathVariable Long projectId,
                                                        @PathVariable Long dependencyId){
        return phaseService.deleteDependency(projectId, dependencyId);
    }

    @PatchMapping("/project/{projectId}/phases/dependency/{dependencyId}")
    public ResponseEntity<Object> updatePhaseDependencyType(@PathVariable Long projectId,
                                                            @PathVariable Long dependencyId,
                                                            @RequestParam DependencyType dependencyType){
        return phaseService.updatePhaseDependencyType(projectId, dependencyId, dependencyType);
    }

    @PutMapping("/project/{projectId}/phase/bulk-update")
    public ResponseEntity<Object> bulkUpdatePhases(
            @PathVariable Long projectId,
            @RequestBody BulkUpdateRequestDTO<PhaseRequestDTO> request) {
        return phaseService.bulkUpdate(projectId, request.getIds(), request.getUpdates());
    }

    @DeleteMapping("/project/{projectId}/phase/bulk-delete")
    public ResponseEntity<Object> bulkDeletePhases(
            @PathVariable Long projectId,
            @RequestBody BulkUpdateRequestDTO<PhaseRequestDTO> request) {
        return phaseService.bulkDelete(projectId, request.getIds());
    }

}
