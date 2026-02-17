package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.models.EntityType;
import com.shantanu.projectstatustracker.models.NotificationType;
import com.shantanu.projectstatustracker.models.User;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;

public interface NotificationService {

    ResponseEntity<Object> getUserNotifications(Long userId, Pageable pageable);

    ResponseEntity<Object> markAsRead(Long notificationId);

    void createNotification(User user,
                            String title,
                            String message,
                            NotificationType type,
                            Long entityId,
                            EntityType entityType);

    public void checkDeadlinesAndNotify();

    ResponseEntity<Object> getUnreadCount(Long userId);

}
