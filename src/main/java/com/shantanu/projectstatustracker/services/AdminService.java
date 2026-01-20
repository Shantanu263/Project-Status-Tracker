package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.InviteUserDTO;
import com.shantanu.projectstatustracker.dtos.RoleRequestDTO;
import org.springframework.http.ResponseEntity;

public interface AdminService {
    ResponseEntity<Object> getUsers(int pageNumber, int pageSize, String sortBy, String order, String search);

    //ResponseEntity<Object> getPendingUsers();

    ResponseEntity<Object> approveUser(Long id, RoleRequestDTO req);

    ResponseEntity<Object> inviteUser(InviteUserDTO inviteUserDTO);
}
