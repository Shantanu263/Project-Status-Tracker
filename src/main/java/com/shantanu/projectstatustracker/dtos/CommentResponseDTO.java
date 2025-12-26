package com.shantanu.projectstatustracker.dtos;

import java.time.LocalDateTime;

public record CommentResponseDTO(
        Long id,
        String content,
        String authorName,
        Long userId,
        LocalDateTime createdAt
) {
}
