package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.PhaseRequestDTO;
import com.shantanu.projectstatustracker.services.PhaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

    @PostMapping("/project/{id}/phases")
    public ResponseEntity<Object> addProjectPhase(@PathVariable(name = "id") Long id,
                                                  @RequestBody PhaseRequestDTO phaseRequestDTO){
        return phaseService.addProjectPhase(id,phaseRequestDTO);
    }
}
