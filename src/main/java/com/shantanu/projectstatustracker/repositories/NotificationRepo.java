package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
interface NotificationRepo extends JpaRepository<Notification, Long> {
    

}
