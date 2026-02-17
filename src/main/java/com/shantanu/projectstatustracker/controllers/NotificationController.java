package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.models.Notification;
import com.shantanu.projectstatustracker.services.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

//    @GetMapping
//    public ResponseEntity<Object> getUserNotifications(@RequestParam(name = "email") String email) {
//        return notificationService.getUserNotifications(email);
//    }

//    @GetMapping
//    public Page<Notification> getNotifications(
//            Pageable pageable) {
//
//        return notificationService.getUserNotifications(user.getId(), pageable);
//    }

    @PostMapping("/mark-read/{id}")
    public ResponseEntity<Object> markAsRead(@PathVariable Long id) {
        return notificationService.markAsRead(id);
    }



}
