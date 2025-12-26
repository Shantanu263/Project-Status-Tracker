package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.models.Status;
import com.shantanu.projectstatustracker.services.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Date;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/project/{projectId}")
public class TaskController {

    private final TaskService taskService;

    @GetMapping("/phases/{phaseId}/tasks")
    public ResponseEntity<Object> getTasks(@PathVariable Long projectId, @PathVariable Long phaseId) {
        return taskService.getPhaseTasks(projectId, phaseId);
    }

    @GetMapping("/phases/{phaseId}/tasks/{taskId}")
    public ResponseEntity<Object> getTaskById(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId) {
        return taskService.getTaskById(projectId, phaseId, taskId);
    }

    @PostMapping("/phases/{phaseId}/tasks")
    public ResponseEntity<Object> createTask(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @RequestBody TaskRequestDTO dto) {
        return taskService.createTask(projectId, phaseId, dto);
    }

    @PutMapping("/phases/{phaseId}/tasks/{taskId}")
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
    
    @PatchMapping("/phases/{phaseId}/tasks/{taskId}/status")
    public ResponseEntity<Object> updateTaskStatus(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @RequestParam Status status) {
        return taskService.updateTaskStatus(projectId, phaseId, taskId, status);
    }

    @GetMapping("/member/{memberId}/tasks")
    public ResponseEntity<Object> getTasksOfAMember(
            @PathVariable Long projectId,
            @PathVariable Long memberId){
        return taskService.getTasksOfAMember(projectId,memberId);
    }

    @PatchMapping("/phases/{phaseId}/tasks/{taskId}/completed")
    public ResponseEntity<Object> updateCompletion(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @RequestParam(name = "completedAt") Date completedAt) {
        return taskService.updateCompletion(projectId, phaseId, taskId, completedAt);
    }

    @PutMapping("/phases/{phaseId}/tasks/{taskId}/comment")
    public ResponseEntity<Object> addComment(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @RequestBody TaskRequestDTO dto) {
        return taskService.updateTask(projectId, phaseId, taskId, dto);
    }

}

