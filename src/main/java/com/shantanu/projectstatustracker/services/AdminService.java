package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.RoleRequestDTO;
import com.shantanu.projectstatustracker.models.User;
import org.springframework.http.ResponseEntity;

import java.util.List;

public interface AdminService {
    ResponseEntity<Object> getUsers();

    ResponseEntity<Object> getPendingUsers();

    ResponseEntity<Object> approveUser(Long id, RoleRequestDTO req);
}
