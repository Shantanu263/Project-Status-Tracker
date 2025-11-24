package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.models.Status;
import com.shantanu.projectstatustracker.services.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/project/{projectId}/phases/{phaseId}/tasks")
//@CrossOrigin(origins = "http://localhost:4200")
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public ResponseEntity<Object> getTasks(@PathVariable Long projectId, @PathVariable Long phaseId) {
        return taskService.getPhaseTasks(projectId, phaseId);
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<Object> getTaskById(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId) {
        return taskService.getTaskById(projectId, phaseId, taskId);
    }

    @PostMapping
    public ResponseEntity<Object> createTask(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @RequestBody TaskRequestDTO dto) {
        return taskService.createTask(projectId, phaseId, dto);
    }

    @PutMapping("/{taskId}")
    public ResponseEntity<Object> updateTask(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @RequestBody TaskRequestDTO dto) {
        return taskService.updateTask(projectId, phaseId, taskId, dto);
    }
//
//    @DeleteMapping("/{taskId}")
//    public ResponseEntity<Object> deleteTask(
//            @PathVariable Long projectId,
//            @PathVariable Long phaseId,
//            @PathVariable Long taskId) {
//        return taskService.deleteTask(projectId, phaseId, taskId);
//    }
    
    @PatchMapping("/{taskId}/status")
    public ResponseEntity<Object> updateTaskStatus(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @RequestParam Status status) {
        return taskService.updateTaskStatus(projectId, phaseId, taskId, status);
    }

}

