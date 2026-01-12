package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.SubTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubTaskRepo extends JpaRepository<SubTask, Long> {

    Optional<SubTask> findBySubTaskIdAndTask_TaskId(Long subTaskId, Long taskTaskId);

    List<SubTask> findByTask_TaskId(Long taskTaskId);

    @Modifying
    @Query("""
        UPDATE SubTask s
        SET s.assignedTo = NULL
        WHERE s.task.projectPhase.project.projectId = :projectId
          AND s.assignedTo.memberId = :memberId
          AND s.status <> 'DONE'
    """)
    void deassignSubtasks(@Param("projectId") Long projectId,
                          @Param("memberId") Long memberId);
}
