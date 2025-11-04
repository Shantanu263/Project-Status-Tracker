package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.RoleResponseDTO;
import com.shantanu.projectstatustracker.models.Role;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface RoleMapper {

    @Mapping(source = "role.name" , target = "roleName")
    RoleResponseDTO mapRole(Role role);

}
