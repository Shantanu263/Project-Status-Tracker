package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.EntityType;
import com.shantanu.projectstatustracker.models.Notification;
import com.shantanu.projectstatustracker.models.NotificationType;
import com.shantanu.projectstatustracker.models.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepo extends JpaRepository<Notification, Long> {
    Page<Notification> findByUser_UserIdOrderByCreatedAtDesc(Long userUserId,
                                                             Pageable pageable);

    boolean existsByEntityIdAndEntityTypeAndTypeAndUser_UserId(Long entityId, EntityType entityType, NotificationType type, Long userUserId);

    long countByUser_UserIdAndIsRead(Long userUserId, Boolean isRead);

    List<Notification> findByUser_UserIdAndIsRead(Long userId, boolean b);
    //List<Notification> findByUserOrderByTimestampDesc(User user);
    
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.projectId = :projectId")
    void deleteByProjectId(Long projectId);
}
