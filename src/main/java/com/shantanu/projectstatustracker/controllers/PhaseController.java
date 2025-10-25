package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.services.PhaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.parameters.P;
import org.springframework.web.bind.annotation.*;

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

    @PostMapping("/project/{id}/phases")
    public ResponseEntity<Object> addProjectPhase(@PathVariable(name = "id") Long id,
                                                  @RequestBody PhaseRequestDTO phaseRequestDTO){
        return phaseService.addProjectPhase(id,phaseRequestDTO);
    }
}
