package com.shantanu.projectstatustracker.services;

import org.springframework.http.ResponseEntity;

public interface CommentService {
    
    ResponseEntity<Object> addCommentToTask(Long taskId, Long userId, String content);
    
    ResponseEntity<Object> addCommentToSubtask(Long subtaskId, Long userId, String content);
    
    ResponseEntity<Object> getCommentsForTask(Long taskId);
    
    ResponseEntity<Object> getCommentsForSubtask(Long subtaskId);

    ResponseEntity<Object> deleteComment(Long commentId, Long userId);

    ResponseEntity<Object> updateComment(Long commentId, Long userId, String content);
}
