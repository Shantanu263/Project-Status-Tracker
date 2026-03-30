package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.DelayLog;
import com.shantanu.projectstatustracker.models.EntityType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DelayLogRepo extends JpaRepository<DelayLog, Long> {

    List<DelayLog> findAllByProjectId(Long projectId);

    Optional<Object> findByProjectIdAndEntityTypeAndPhaseIdAndTaskId(Long projectId, EntityType entityType, Long phaseId, Long taskId);

    boolean existsByProjectIdAndEntityTypeAndPhaseId(Long projectId, EntityType entityType, Long phaseId);

    boolean existsByProjectIdAndEntityTypeAndPhaseIdAndTaskId(Long projectId, EntityType entityType, Long phaseId, Long taskId);
}
