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
    public ResponseEntity<Object> getUsers(){
        return adminService.getUsers();
    }

    @GetMapping("/pending-users")
    public ResponseEntity<Object> getPendingUsers() {
        return adminService.getPendingUsers();
    }

    @PutMapping("/approve-user/{id}")
    public ResponseEntity<?> approveUser(@PathVariable Long id, @RequestBody RoleRequestDTO req) {
        return  adminService.approveUser(id,req);
    }
}
