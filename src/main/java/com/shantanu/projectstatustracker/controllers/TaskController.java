package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.BulkUpdateRequestDTO;
import com.shantanu.projectstatustracker.dtos.DependencyRequestDTO;
import com.shantanu.projectstatustracker.dtos.SubTaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.models.DependencyType;
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

    @PatchMapping("/phases/{phaseId}/tasks/{taskId}/status")
    public ResponseEntity<Object> updateTaskStatus(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @RequestParam Status status) {
        return taskService.updateTaskStatus(projectId, phaseId, taskId, status);
    }

    @DeleteMapping("/phases/{phaseId}/tasks/{taskId}")
    public ResponseEntity<Object> deleteTask(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId
    ){
        return taskService.deleteTask(projectId,phaseId,taskId);
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

    @GetMapping("/phases/{phaseId}/tasks/{taskId}/subtasks/{subTaskId}")
    public ResponseEntity<Object> getSubTaskById(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @PathVariable Long subTaskId
    ){
        return taskService.getSubTaskById(projectId,phaseId,taskId,subTaskId);
    }

    @PostMapping("/phases/{phaseId}/tasks/{taskId}/subtasks")
    public ResponseEntity<Object> addSubTask(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @RequestBody SubTaskRequestDTO subTaskRequestDTO
    ){
        return taskService.addSubTask(projectId,phaseId,taskId,subTaskRequestDTO);
    }

    @PutMapping("/phases/{phaseId}/tasks/{taskId}/subtasks/{subTaskId}")
    public ResponseEntity<Object> updateSubTask(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @PathVariable Long subTaskId,
            @RequestBody SubTaskRequestDTO subTaskRequestDTO
    ){
        return taskService.updateSubTask(projectId,phaseId,taskId,subTaskId,subTaskRequestDTO);
    }

    @DeleteMapping("/phases/{phaseId}/tasks/{taskId}/subtasks/{subTaskId}")
    public ResponseEntity<Object> deleteSubTask(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long taskId,
            @PathVariable Long subTaskId
    ){
        return taskService.deleteSubTask(projectId,phaseId,taskId,subTaskId);
    }

    @PostMapping("/phases/{phaseId}/tasks/dependency")
    public ResponseEntity<Object> createTaskDependency(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @RequestBody DependencyRequestDTO dto){
        return taskService.createDependency(dto.getPredecessorId(), dto.getSuccessorId(), phaseId, dto.getDependencyType());
    }

    @DeleteMapping("/phases/{phaseId}/tasks/dependency/{dependencyId}")
    public ResponseEntity<Object> deleteTaskDependency(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long dependencyId){
        return taskService.deleteDependency(phaseId, dependencyId);
    }

    @PatchMapping("/phases/{phaseId}/tasks/dependency/{dependencyId}")
    public ResponseEntity<Object> updateTaskDependencyType(
            @PathVariable Long projectId,
            @PathVariable Long phaseId,
            @PathVariable Long dependencyId,
            @RequestParam DependencyType dependencyType){
        return taskService.updateTaskDependencyType(phaseId, dependencyId, dependencyType);
    }

    @GetMapping("/phases/{phaseId}/tasks/dependency")
    public ResponseEntity<Object> getPhaseDependencies(@PathVariable Long phaseId){
        return taskService.getTaskDependencies(phaseId);
    }

    @PutMapping("/tasks/bulk-update")
    public ResponseEntity<Object> bulkUpdateTasks(
            @PathVariable Long projectId,
            @RequestBody BulkUpdateRequestDTO<TaskRequestDTO> request) {
        return taskService.bulkUpdate(projectId, request.getIds(), request.getUpdates());
    }

    @DeleteMapping("/tasks/bulk-delete")
    public ResponseEntity<Object> bulkDeleteTasks(
            @PathVariable Long projectId,
            @RequestBody BulkUpdateRequestDTO<TaskRequestDTO> request) {
        return taskService.bulkDelete(projectId, request.getIds());
    }

}

