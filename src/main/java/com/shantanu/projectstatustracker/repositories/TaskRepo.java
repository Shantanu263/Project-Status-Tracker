package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepo extends JpaRepository<Task,Long> {

    List<Task> findByProjectPhase_PhaseId(Long projectPhasePhaseId);

    List<Task> findAllByProjectPhase_PhaseId(Long projectPhasePhaseId);

    Optional<Task> findByTaskName(String taskName);

    Optional<Task> findByTaskIdAndProjectPhase_PhaseId(Long taskId, Long phaseId);

    @Modifying
    @Query("UPDATE Task t SET t.projectPhase = null WHERE t.projectPhase.phaseId = :phaseId")
    void clearTasksPhase(@Param("phaseId") Long phaseId);
}
