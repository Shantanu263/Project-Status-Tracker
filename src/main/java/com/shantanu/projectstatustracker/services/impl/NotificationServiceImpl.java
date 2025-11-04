package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.models.Notification;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.NotificationRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepo notificationRepo;
    private final UserRepo userRepo;

    @Override
    public ResponseEntity<Object> getUserNotifications(String email) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        //List<Notification> notifications = notificationRepo.findByUserOrderByTimestampDesc(user);
        return ResponseEntity.ok("notifications");
    }

    @Override
    public ResponseEntity<Object> markAsRead(Long notificationId) {
        Notification notification = notificationRepo.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setIsRead(true);
        notificationRepo.save(notification);
        return ResponseEntity.ok("Notification marked as read");
    }

    @Override
    public void createNotification(String email, String message) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        Notification notification = Notification.builder()
                .message(message)
                .user(user)
                .build();
        notificationRepo.save(notification);
    }

}
