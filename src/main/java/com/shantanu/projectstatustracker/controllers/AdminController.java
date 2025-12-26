package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.RoleRequestDTO;
import com.shantanu.projectstatustracker.services.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RequiredArgsConstructor
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService adminService;

    @GetMapping("/users")
    public ResponseEntity<Object> getUsers(
            @RequestParam(value = "page", defaultValue = "0", required = false) int pageNumber,
            @RequestParam(value = "size", defaultValue = "5", required = false) int pageSize,
            @RequestParam(value = "sortBy", defaultValue = "id", required = false) String sortBy,
            @RequestParam(value = "order", defaultValue = "asc", required = false) String order,
            @RequestParam(value = "search", required = false) String search
    ){
        return adminService.getUsers(pageNumber, pageSize, sortBy, order, search);
    }

    @GetMapping("/pending-users")
    public ResponseEntity<Object> getPendingUsers() {
        return adminService.getPendingUsers();
    }

    @PutMapping("/change-role/{id}")
    public ResponseEntity<?> approveUser(@PathVariable Long id, @RequestBody RoleRequestDTO req) {
        return  adminService.approveUser(id,req);
    }

}
