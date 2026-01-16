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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;


@RequiredArgsConstructor
@Service
public class AdminServiceImpl implements AdminService {
    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final UserMapper userMapper;

    @Override
    public ResponseEntity<Object> getUsers(int pageNumber, int pageSize, String sortBy, String order, String search) {

        Sort sort = order.equalsIgnoreCase("desc") ?
                Sort.by(sortBy).descending() :
                Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(pageNumber, pageSize, sort);

        String searchValue = (search == null || search.isBlank()) ? "" : search;

        Page<User> result = userRepo.searchUsers(searchValue, pageable);

        return ResponseEntity.ok(toPaginatedResponse(result));

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

        return ResponseEntity.ok(Map.of("message","Assigned role to user: " + req.getRoleName()));
    }

    public Map<String, Object> toPaginatedResponse(Page<User> page) {
        Map<String, Object> response = new HashMap<>();
        response.put("content", page.getContent().stream()
                .map(userMapper::mapUserToUserResponseDTO)
                .toList());
        response.put("page", page.getNumber());
        response.put("totalElements", page.getTotalElements());
        response.put("totalPages", page.getTotalPages());
        response.put("size", page.getSize());
        response.put("isLast", page.isLast());
        return response;

    }

}
