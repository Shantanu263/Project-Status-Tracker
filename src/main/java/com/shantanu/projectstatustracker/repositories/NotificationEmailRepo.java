package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.EntityType;
import com.shantanu.projectstatustracker.models.NotificationEmail;
import com.shantanu.projectstatustracker.models.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationEmailRepo extends JpaRepository<NotificationEmail,Long>{

    //boolean existsByEntityIdAndEntityTypeAndUser_UserId(Long entityId, EntityType entityType, Long userUserId);

    boolean existsByEntityIdAndEntityTypeAndNotificationTypeAndUser_UserId(Long entityId, EntityType entityType, NotificationType notificationType, Long userUserId);
}
