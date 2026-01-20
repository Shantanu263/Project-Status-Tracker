package com.shantanu.projectstatustracker.dtos;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class InviteUserDTO {

    @NotNull
    private String email;

    @NotNull
    private String roleName;

}
