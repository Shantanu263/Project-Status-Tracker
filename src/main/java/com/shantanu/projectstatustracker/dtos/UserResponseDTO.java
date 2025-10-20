package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.Role;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class UserResponseDTO {
    Long userId;
    String name;
    String email;
    RoleResponseDTO role;
}
