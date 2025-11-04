package com.shantanu.projectstatustracker.services;

import org.springframework.http.ResponseEntity;

public interface NotificationService {

    ResponseEntity<Object> getUserNotifications(String email);

    ResponseEntity<Object> markAsRead(Long notificationId);

    void createNotification(String email, String message);

}
