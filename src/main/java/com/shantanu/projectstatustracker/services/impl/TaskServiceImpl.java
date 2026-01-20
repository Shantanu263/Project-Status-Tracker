package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.SubTaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.TaskRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.SubTaskMapper;
import com.shantanu.projectstatustracker.dtos.mappers.TaskMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.*;

@RequiredArgsConstructor
@Service
public class TaskServiceImpl implements TaskService {

    private final TaskRepo taskRepo;
    private final PhaseRepo phaseRepo;
    private final TaskMapper taskMapper;
    private final ProjectMemberRepo projectMemberRepo;
    private final PhaseServiceImpl phaseService;
    private final HttpServletRequest request;
    private final ActivityLogService activityLogService;
    private final ProjectRepo projectRepo;
    private final SubTaskMapper subTaskMapper;
    private final SubTaskRepo subTaskRepo;

    @Override
    public ResponseEntity<Object> getPhaseTasks(Long projectId, Long phaseId) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        List<Task> tasks = taskRepo.findByProjectPhase_PhaseId(phaseId);

        return ResponseEntity.ok(taskMapper.mapTasksToResponse(tasks));
    }

    @Override
    public ResponseEntity<Object> getTaskById(Long projectId, Long phaseId, Long taskId) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found."));

        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId, phaseId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        return ResponseEntity.ok(taskMapper.mapTaskToResponse(task));
    }

    @Override
    public ResponseEntity<Object> createTask(Long projectId, Long phaseId, TaskRequestDTO taskRequestDTO) {
        Phase phase = phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        ProjectMember assignedTo = null;

        if (taskRequestDTO.getAssignedTo() != null){
             assignedTo = projectMemberRepo.findById(taskRequestDTO.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project Member not found"));
        }

        Task task = taskMapper.mapTaskRequestDTOToTask(taskRequestDTO,phase,assignedTo);
        task.setProgress(0.0);
        taskRepo.save(task);
        
        // Update phase progress after creating a task
        phaseService.updatePhaseProgress(phaseId);

        activityLogService.log(
                phase.getProject().getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " created new Task " + taskRequestDTO.getTaskName(),
                EntityType.TASK,
                task.getTaskId()
        );

        //causing problems
        //return ResponseEntity.ok(Map.of("message","New Task Created","new task",task));
        return ResponseEntity.ok(task);
    }

    @Override
    public ResponseEntity<Object> updateTask(Long projectId, Long phaseId, Long taskId, TaskRequestDTO dto) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        ProjectMember assignedTo = null;

        if (dto.getAssignedTo() != null) {
            assignedTo = projectMemberRepo.findById(dto.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));
        }

        Task existingTask = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        TaskSnapshot oldSnapshot = TaskSnapshot.from(existingTask);

        taskMapper.updateTaskFromDTO(dto,assignedTo,existingTask);

        if (dto.getStatus()!= null && dto.getStatus().equals(Status.DONE)) existingTask.setCompletedAt(new Date());
        else existingTask.setCompletedAt(null);

        taskRepo.save(existingTask);
        
        // Update phase progress with respect to Task Status
        phaseService.updatePhaseProgress(phaseId);

        // Update task progress with respect to subTask Status
        updateTaskProgress(taskId);

        List<String> changes = detectChanges(oldSnapshot, existingTask);

        for (String change : changes) {
            activityLogService.log(
                    projectId,
                    (String) request.getAttribute("email"),
                    request.getAttribute("username") + " " + change,
                    EntityType.TASK,
                    existingTask.getTaskId());
        }

        return ResponseEntity.ok(Map.of("message","Task updated","update Task",taskMapper.mapTaskToResponse(existingTask)));
    }

    @Override
    public ResponseEntity<Object> deleteTask(Long projectId, Long phaseId, Long taskId) {
        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        taskRepo.delete(task);

        // Update task progress with respect to subTask Status
        phaseService.updatePhaseProgress(phaseId);

        return ResponseEntity.ok(Map.of("message","Task deleted"));
    }

    @Override
    public ResponseEntity<Object> updateTaskStatus(Long projectId, Long phaseId, Long taskId, Status status) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        Task existingTask = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        ProjectMember member = projectMemberRepo.findByProject_ProjectIdAndUser_Email(projectId,(String) request.getAttribute("email"));

        if (member.getRole() == ProjectRole.PROJECT_HANDLER && existingTask.getAssignedTo() != member) {
            return new ResponseEntity<>(Map.of("message", "This task is assigned to other user."), HttpStatus.BAD_REQUEST);
        }

//        if (status == Status.DONE && !existingTask.getSubTasks().isEmpty() && existingTask.getProgress()!=100.0) {
//            return new ResponseEntity<>(Map.of("message","All Sub Tasks not completed. Cannot change status"),
//                    HttpStatus.BAD_REQUEST);
//        }

        Status existingStatus = existingTask.getStatus();
        existingTask.setStatus(status);

        if (status.equals(Status.DONE)) existingTask.setCompletedAt(new Date());
        else existingTask.setCompletedAt(null);

        taskRepo.save(existingTask);
        
        // Update phase progress with respect to Task Status
        phaseService.updatePhaseProgress(phaseId);

        // Update task progress
        //updateTaskProgress(taskId);

        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " changed status from " + existingStatus + " to " + status,
                EntityType.TASK,
                existingTask.getTaskId()
        );

        return ResponseEntity.ok(Map.of("message","Task status updated","updated Task",taskMapper.mapTaskToResponse(existingTask)));
    }

    @Override
    public ResponseEntity<Object> getTasksOfAMember(Long projectId, Long memberId) {
        if (!projectRepo.existsById(projectId)) return new ResponseEntity<>(Map.of("message", "Project not found"),HttpStatus.NOT_FOUND);
        if (!projectMemberRepo.existsById(memberId)) return new ResponseEntity<>(Map.of("message", "Project Member not found"),HttpStatus.NOT_FOUND);

        return ResponseEntity.ok(taskMapper.mapTasksToResponse(taskRepo.findByAssignedTo_MemberId(memberId)));
    }

    @Override
    public ResponseEntity<Object> updateCompletion(Long projectId, Long phaseId, Long taskId, Date completedAt) {
        phaseRepo.findByPhaseIdAndProject_ProjectId(phaseId,projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Phase not found"));

        Task existingTask = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        ProjectMember member = projectMemberRepo.findByProject_ProjectIdAndUser_Email(projectId,(String) request.getAttribute("email"));

        if (member.getRole() == ProjectRole.PROJECT_HANDLER && existingTask.getAssignedTo() != member) {
            return new ResponseEntity<>(Map.of("message", "This task is assigned to other user."), HttpStatus.BAD_REQUEST);
        }

        existingTask.setCompletedAt(completedAt);
        taskRepo.save(existingTask);

        return ResponseEntity.ok(Map.of("message","Completion updated"));
    }

    @Override
    public ResponseEntity<Object> addSubTask(Long projectId, Long phaseId, Long taskId, SubTaskRequestDTO subTaskRequestDTO) {

        Task task = taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        ProjectMember assignedTo = null;

        if (subTaskRequestDTO.getAssignedTo() != null){
            assignedTo = projectMemberRepo.findById(subTaskRequestDTO.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project Member not found"));
        }

        SubTask subTask = subTaskMapper.mapRequestToSubTask(subTaskRequestDTO,task,assignedTo);
        subTaskRepo.save(subTask);

        // Update task progress with respect to subTask Status
        updateTaskProgress(taskId);

        activityLogService.log(
                task.getProjectPhase().getProject().getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + " created new Sub Task " + subTaskRequestDTO.getSubTaskName(),
                EntityType.SUBTASK,
                subTask.getSubTaskId()
        );

        return ResponseEntity.ok(subTaskMapper.mapSubTaskToResponse(subTask));
    }

    @Override
    public ResponseEntity<Object> updateSubTask(Long projectId, Long phaseId, Long taskId, Long subTaskId, SubTaskRequestDTO subTaskRequestDTO) {
        taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        ProjectMember assignedTo = null;

        if (subTaskRequestDTO.getAssignedTo() != null) {
            assignedTo = projectMemberRepo.findById(subTaskRequestDTO.getAssignedTo())
                    .orElseThrow(() -> new ResourceNotFoundException("Project member not found"));
        }

        SubTask existingSubTask = subTaskRepo.findBySubTaskIdAndTask_TaskId(subTaskId,taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Sub Task not found"));

        SubTaskSnapshot oldSnapshot = SubTaskSnapshot.from(existingSubTask);

        subTaskMapper.updateSubTaskFromDTO(subTaskRequestDTO,assignedTo,existingSubTask);

        subTaskRepo.save(existingSubTask);

        // Update task progress with respect to subTask Status
        updateTaskProgress(taskId);

        List<String> changes = detectChanges(oldSnapshot, existingSubTask);

        for (String change : changes) {
            activityLogService.log(
                    projectId,
                    (String) request.getAttribute("email"),
                    request.getAttribute("username") + " " + change,
                    EntityType.SUBTASK,
                    existingSubTask.getSubTaskId());
        }

        return ResponseEntity.ok(Map.of("message","Sub Task updated","update Sub Task",subTaskMapper.mapSubTaskToResponse(existingSubTask)));
    }

    @Override
    public ResponseEntity<Object> deleteSubTask(Long projectId, Long phaseId, Long taskId, Long subTaskId) {
        taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        SubTask subTask = subTaskRepo.findBySubTaskIdAndTask_TaskId(subTaskId,taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Sub Task not found"));

        subTaskRepo.delete(subTask);

        // Update task progress with respect to subTask Status
        updateTaskProgress(taskId);

        return ResponseEntity.ok(Map.of("message","Sub Task deleted"));
    }


    @Override
    public ResponseEntity<Object> getSubTaskById(Long projectId, Long phaseId, Long taskId, Long subTaskId) {
        taskRepo.findByTaskIdAndProjectPhase_PhaseId(taskId,phaseId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        SubTask subTask = subTaskRepo.findBySubTaskIdAndTask_TaskId(subTaskId,taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Sub Task not found"));

        return ResponseEntity.ok(subTaskMapper.mapSubTaskToResponse(subTask));
    }

    public static List<String> detectChanges(TaskSnapshot oldTask, Task newTask) {
        List<String> changes = new ArrayList<>();

        // Task Name
        if (!Objects.equals(oldTask.taskName(), newTask.getTaskName())) {
            changes.add("updated task name from '"
                    + oldTask.taskName() + "' to '" + newTask.getTaskName() + "'");
        }

        // Description
        if (!Objects.equals(oldTask.description(), newTask.getDescription())) {
            changes.add("updated description");
        }

        // Status
        if (!Objects.equals(oldTask.status(), newTask.getStatus())) {
            changes.add("updated status from '"
                    + oldTask.status() + "' to '" + newTask.getStatus() + "'");
        }

        // Priority
        if (!Objects.equals(oldTask.priority(), newTask.getPriority())) {
            changes.add("updated priority from '"
                    + oldTask.priority() + "' to '" + newTask.getPriority() + "'");
        }

        // Assigned To (Assuming assignedTo is a User object)
        if (oldTask.assignedToId() == null && newTask.getAssignedTo() != null) {
            changes.add("assigned task to '" + newTask.getAssignedTo().getUser().getName() + "'");
        }
        else if (oldTask.assignedToId() != null && newTask.getAssignedTo() == null) {
            changes.add("unassigned the task from '" + oldTask.assignedToUsername() + "'");
        }
        else if (
                oldTask.assignedToId() != null && !Objects.equals(oldTask.assignedToId(), newTask.getAssignedTo().getUser().getUserId())
        ) {
            changes.add("changed assignee from '"
                    + oldTask.assignedToUsername() + "' to '"
                    + newTask.getAssignedTo().getUser().getName() + "'");
        }

        // Start Date
        if (!Objects.equals(oldTask.startDate(), newTask.getStartDate())) {
            changes.add("updated start date from "
                    + oldTask.startDate() + " to " + newTask.getStartDate());
        }

        // End Date
        if (!Objects.equals(oldTask.endDate(), newTask.getEndDate())) {
            changes.add("updated end date from "
                    + oldTask.endDate() + " to " + newTask.getEndDate());
        }

        return changes;
    }

    public static List<String> detectChanges(SubTaskSnapshot oldSubTask, SubTask newSubTask) {
        List<String> changes = new ArrayList<>();

        // Task Name
        if (!Objects.equals(oldSubTask.subTaskName(), newSubTask.getSubTaskName())) {
            changes.add("updated task name from '"
                    + oldSubTask.subTaskName() + "' to '" + newSubTask.getSubTaskName() + "'");
        }

        // Status
        if (!Objects.equals(oldSubTask.status(), newSubTask.getStatus())) {
            changes.add("updated status from '"
                    + oldSubTask.status() + "' to '" + newSubTask.getStatus() + "'");
        }

        // Priority
        if (!Objects.equals(oldSubTask.priority(), newSubTask.getPriority())) {
            changes.add("updated priority from '"
                    + oldSubTask.priority() + "' to '" + newSubTask.getPriority() + "'");
        }

        // Assigned To (Assuming assignedTo is a User object)
        if (oldSubTask.assignedToId() == null && newSubTask.getAssignedTo() != null) {
            changes.add("assigned sub task to '" + newSubTask.getAssignedTo().getUser().getName() + "'");
        }
        else if (oldSubTask.assignedToId() != null && newSubTask.getAssignedTo() == null) {
            changes.add("unassigned the sub task from '" + oldSubTask.assignedToUsername() + "'");
        }
        else if (
                oldSubTask.assignedToId() != null && !Objects.equals(oldSubTask.assignedToId(), newSubTask.getAssignedTo().getUser().getUserId())
        ) {
            changes.add("changed assignee from '"
                    + oldSubTask.assignedToUsername() + "' to '"
                    + newSubTask.getAssignedTo().getUser().getName() + "'");
        }

        // Start Date
        if (!Objects.equals(oldSubTask.startDate(), newSubTask.getStartDate())) {
            changes.add("updated start date from "
                    + oldSubTask.startDate() + " to " + newSubTask.getStartDate());
        }

        // End Date
        if (!Objects.equals(oldSubTask.endDate(), newSubTask.getEndDate())) {
            changes.add("updated end date from "
                    + oldSubTask.endDate() + " to " + newSubTask.getEndDate());
        }

        return changes;
    }

    @Override
    public Double updateTaskProgress(Long taskId) {
        Task task = taskRepo.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found"));

        List<SubTask> subTasks = subTaskRepo.findByTask_TaskId(taskId);

        if (subTasks.isEmpty()) {
            if (Status.DONE.equals(task.getStatus())) task.setProgress(100.0);
            else task.setProgress(0.0);
            taskRepo.save(task);
            return task.getProgress();
        }

        long completedSubTasks = subTasks.stream()
                .filter(subTask -> Status.DONE.equals(subTask.getStatus()))
                .count();

        Double progress = (double) completedSubTasks / subTasks.size() * 100;

        //If the task is completed, but new subtask has been added later
        if (task.getStatus().equals(Status.DONE) && progress!=100.0) task.setStatus(Status.IN_PROGRESS);

        //If all subtasks are completed, set Task Status to 'DONE'
//        if (progress == 100.0) task.setStatus(Status.DONE);

        task.setProgress(progress);
        taskRepo.save(task);

        // Update the phase progress after updating the task progress
        //phaseService.updatePhaseProgress(task.getProjectPhase().getPhaseId());

        return progress;
    }

}
