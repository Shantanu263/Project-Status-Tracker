package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepo extends JpaRepository<ActivityLog, Long> {

    @Query("""
        SELECT a\s
        FROM ActivityLog a\s
        WHERE a.project.projectId = :projectId
        ORDER BY a.createdAt DESC
       \s""")
    Page<ActivityLog> findRecentActivity(
            @Param("projectId") Long projectId,
            Pageable pageable
    );

    //List<ActivityLog> findRecentActivity(Long projectId);
}
