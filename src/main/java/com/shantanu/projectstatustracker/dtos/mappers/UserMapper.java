package com.shantanu.projectstatustracker.dtos.mappers;

import com.shantanu.projectstatustracker.dtos.UserRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserResponseDTO;
import com.shantanu.projectstatustracker.models.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

@Mapper(componentModel = "spring")
public interface UserMapper {
    UserResponseDTO mapUserToUserResponseDTO(User user);

    @Mapping(source = "user.role.name",target = "role")
    List<UserResponseDTO> mapUsers(List<User> users);

    User mapRequestToUser(UserRequestDTO userRequestDTO);
}
