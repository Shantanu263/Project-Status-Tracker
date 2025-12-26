package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.mappers.CommentMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Comment;
import com.shantanu.projectstatustracker.models.ParentType;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.CommentRepo;
import com.shantanu.projectstatustracker.repositories.SubTaskRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CommentServiceImpl implements CommentService {

    private final CommentRepo commentRepo;
    private final TaskRepo taskRepo;
    private final SubTaskRepo subTaskRepo;
    private final UserRepo userRepo;
    private final CommentMapper commentMapper;

    @Override
    public ResponseEntity<Object> addCommentToTask(Long taskId, Long userId, String content) {
        taskRepo.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId));

        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        Comment comment = Comment.builder()
                .parentId(taskId)
                .parentType(ParentType.TASK)
                .user(user)
                .content(content)
                .build();

        Comment savedComment = commentRepo.save(comment);

        return ResponseEntity.ok(commentMapper.mapCommentToResponse(savedComment));
    }

    @Override
    public ResponseEntity<Object> addCommentToSubtask(Long subtaskId, Long userId, String content) {
        subTaskRepo.findById(subtaskId)
                .orElseThrow(() -> new ResourceNotFoundException("Subtask not found with id: " + subtaskId));

        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        Comment comment = Comment.builder()
                .parentId(subtaskId)
                .parentType(ParentType.SUBTASK)
                .user(user)
                .content(content)
                .build();

        Comment savedComment = commentRepo.save(comment);

        return ResponseEntity.ok(commentMapper.mapCommentToResponse(savedComment));
    }

    @Override
    public ResponseEntity<Object> getCommentsForTask(Long taskId) {
        // Verify task exists
        taskRepo.findById(taskId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + taskId));

        List<Comment> comments = commentRepo.findByParentIdAndParentTypeOrderByCreatedAtAsc(taskId, ParentType.TASK);

        return ResponseEntity.ok(commentMapper.mapCommentsToResponse(comments));
    }

    @Override
    public ResponseEntity<Object> getCommentsForSubtask(Long subtaskId) {
        // Verify subtask exists
        subTaskRepo.findById(subtaskId)
                .orElseThrow(() -> new ResourceNotFoundException("Subtask not found with id: " + subtaskId));

        List<Comment> comments = commentRepo.findByParentIdAndParentTypeOrderByCreatedAtAsc(subtaskId, ParentType.SUBTASK);

        return ResponseEntity.ok(commentMapper.mapCommentsToResponse(comments));
    }

    @Override
    public ResponseEntity<Object> deleteComment(Long commentId, Long userId) {
        Comment comment = commentRepo.findById(commentId).orElseThrow();

        boolean isAuthor = comment.getUser().getUserId().equals(userId);
        if (!isAuthor) return new ResponseEntity<>(Map.of("message","You are not allowed to delete this comment"), HttpStatus.UNAUTHORIZED);

        commentRepo.delete(comment);
        return ResponseEntity.ok(Map.of("message","Comment deleted successfully"));
    }

    @Override
    public ResponseEntity<Object> updateComment(Long commentId, Long userId, String content) {
        Comment existingComment = commentRepo.findById(commentId)
                .orElseThrow(() -> new ResourceNotFoundException("Comment not found"));

        if(!existingComment.getUser().getUserId().equals(userId)) return new ResponseEntity<>(Map.of("message","You are not allowed to delete this comment"),HttpStatus.UNAUTHORIZED);

        if(content == null || content.isEmpty()) return new ResponseEntity<>(Map.of("message","Empty message"),HttpStatus.NOT_ACCEPTABLE);

        existingComment.setContent(content);
        commentRepo.save(existingComment);
        return ResponseEntity.ok(commentMapper.mapCommentToResponse(existingComment));
    }

}

