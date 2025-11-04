package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Notification;
import com.shantanu.projectstatustracker.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepo extends JpaRepository<Notification, Long> {
    //List<Notification> findByUserOrderByTimestampDesc(User user);
}
