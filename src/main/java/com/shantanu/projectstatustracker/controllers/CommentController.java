package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.CommentRequestDTO;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.CommentService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/project")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;
    private final HttpServletRequest request;
    private final UserRepo userRepo;

    @PostMapping("/tasks/{taskId}/comments")
    public ResponseEntity<Object> addTaskComment(
            @PathVariable Long taskId,
            @RequestBody CommentRequestDTO commentRequestDTO) {

        User user = userRepo.findByEmail((String) request.getAttribute("email"))
                .orElseThrow(() -> new ResourceNotFoundException("User Not Found"));
        Long userId = user.getUserId();
        return commentService.addCommentToTask(taskId, userId, commentRequestDTO.content());
    }

    @PostMapping("/subtasks/{subtaskId}/comments")
    public ResponseEntity<Object> addSubtaskComment(
            @PathVariable Long subtaskId,
            @RequestBody CommentRequestDTO commentRequestDTO) {

        User user = userRepo.findByEmail((String) request.getAttribute("email"))
                .orElseThrow(() -> new ResourceNotFoundException("User Not Found"));
        Long userId = user.getUserId();
        return commentService.addCommentToSubtask(subtaskId, userId, commentRequestDTO.content());
    }

    @GetMapping("/tasks/{taskId}/comments")
    public ResponseEntity<Object> getCommentsForTask(@PathVariable Long taskId) {
        return commentService.getCommentsForTask(taskId);
    }

    @GetMapping("/subtasks/{subtaskId}/comments")
    public ResponseEntity<Object> getCommentsForSubtask(@PathVariable Long subtaskId) {
        return commentService.getCommentsForSubtask(subtaskId);
    }

    @PatchMapping("/comments/{commentId}")
    public ResponseEntity<Object> updateComment(@PathVariable Long commentId,
                                                @RequestBody CommentRequestDTO commentRequestDTO) {
        User user = userRepo.findByEmail((String) request.getAttribute("email"))
                .orElseThrow(() -> new ResourceNotFoundException("User Not Found"));
        Long userId = user.getUserId();
        return commentService.updateComment(commentId, userId, commentRequestDTO.content());
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Object> deleteComment(@PathVariable Long commentId) {
        User user = userRepo.findByEmail((String) request.getAttribute("email"))
                .orElseThrow(() -> new ResourceNotFoundException("User Not Found"));
        Long userId = user.getUserId();
        return commentService.deleteComment(commentId, userId);
    }

}

