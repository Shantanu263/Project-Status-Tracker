package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.Status;
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

    @Query(value = """
    SELECT COUNT(*)
    FROM tasks t
    JOIN phase p ON t.project_phase_phase_id = p.phase_id
    WHERE p.project_id = :projectId
      AND t.end_date < CURRENT_DATE
      AND t.status <> 'DONE'
    """, nativeQuery = true)
    int countOverdueTasks(Long projectId);

    @Query(value = """
    SELECT 
        t.task_name AS taskName,
        t.end_date AS deadline,
        u.name AS assignedTo,
        DATE_PART('day', t.end_date - CURRENT_DATE) AS daysLeft
    FROM tasks t
    JOIN phase p ON t.project_phase_phase_id = p.phase_id
    LEFT JOIN users u ON t.assigned_to_member_id = u.user_id
    WHERE p.project_id = :projectId
      AND t.end_date >= CURRENT_DATE
    ORDER BY t.end_date ASC
    LIMIT 5
    """, nativeQuery = true)
    List<Object[]> findUpcomingDeadlines(Long projectId);

    @Query(value = """
    SELECT DATE(t.end_date) AS date, COUNT(*)
    FROM tasks t
    JOIN phase p ON t.project_phase_phase_id = p.phase_id
    WHERE p.project_id = :projectId
      AND t.status = 'DONE'
    GROUP BY DATE(t.end_date)
    ORDER BY DATE(t.end_date)
    """, nativeQuery = true)
    List<Object[]> getCompletedTasksOverTime(Long projectId);

    @Query(value = """
    SELECT t.priority, COUNT(*)
    FROM tasks t
    JOIN phase p ON t.project_phase_phase_id = p.phase_id
    WHERE p.project_id = :projectId
    GROUP BY t.priority
    """, nativeQuery = true)
    List<Object[]> getPriorityDistribution(Long projectId);

    @Query(value = """
    SELECT t.status, COUNT(*)
    FROM tasks t
    JOIN phase p ON t.project_phase_phase_id = p.phase_id
    WHERE p.project_id = :projectId
    GROUP BY t.status
    """, nativeQuery = true)
    List<Object[]> getTaskDistribution(Long projectId);

    int countByProjectPhase_Project(Project projectPhaseProject);

    int countByProjectPhase_ProjectAndStatus(Project projectPhaseProject, Status status);

    @Query(value = """
    SELECT COUNT(*)
    FROM tasks t
    JOIN phase p ON t.project_phase_phase_id = p.phase_id
    WHERE p.project_id = :projectId
      AND t.assigned_to_member_id IS NOT NULL
    """, nativeQuery = true)
    int countAssignedTasks(Long projectId);
}
