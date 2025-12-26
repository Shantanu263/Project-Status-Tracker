package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.Role;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class UserResponseDTO {
    Long userId;
    String name;
    String email;
    LocalDateTime createdAt;
    RoleResponseDTO role;
}

