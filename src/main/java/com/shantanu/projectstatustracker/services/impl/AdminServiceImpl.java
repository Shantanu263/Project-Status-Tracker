package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.RoleRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.UserMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Role;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.RoleRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;


@RequiredArgsConstructor
@Service
public class AdminServiceImpl implements AdminService {
    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final UserMapper userMapper;

    @Override
    public ResponseEntity<Object> getUsers() {
        List<User> users = userRepo.findAll();
        return ResponseEntity.ok(userMapper.mapUsers(users));
    }

    @Override
    public ResponseEntity<Object> getPendingUsers() {
        return ResponseEntity.ok(userMapper.mapUsers(userRepo.findByStatus("PENDING")));
    }

    @Override
    public ResponseEntity<Object> approveUser(Long id, RoleRequestDTO req) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        Role role = roleRepo.findByName(req.getRoleName())
                .orElseThrow(() -> new ResourceNotFoundException("Role not found with name: " + req.getRoleName()));

        user.setRole(role);
        user.setStatus("ACTIVE");
        userRepo.save(user);

        return ResponseEntity.ok("User approved and assigned role: " + req.getRoleName());
    }

}
