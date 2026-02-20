package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.Status;
import com.shantanu.projectstatustracker.models.Task;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Date;
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
      AND t.status <> 'COMPLETED'
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
    JOIN project_members m ON t.assigned_to_member_id = m.member_id
    LEFT JOIN users u ON m.user_user_id = u.user_id
    WHERE p.project_id = :projectId
      AND t.end_date >= CURRENT_DATE
      AND t.status <> 'COMPLETED'
    ORDER BY t.end_date ASC
    LIMIT 5
    """, nativeQuery = true)
    List<Object[]> findUpcomingDeadlines(Long projectId);

    @Query(value = """
    SELECT DATE(t.completed_at) AS date, COUNT(*) AS count
    FROM tasks t
    JOIN phase p ON t.project_phase_phase_id = p.phase_id
    WHERE p.project_id = :projectId
      AND t.completed_at IS NOT NULL
    GROUP BY DATE(t.completed_at)
    ORDER BY DATE(t.completed_at)
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

    List<Task> findByAssignedTo_MemberId(Long assignedToMemberId);

    @Modifying
    @Query("""
        UPDATE Task t
        SET t.assignedTo = NULL
        WHERE t.projectPhase.project.projectId = :projectId
          AND t.assignedTo.memberId = :memberId
          AND t.status <> 'COMPLETED'
    """)
    void deassignTasks(@Param("projectId") Long projectId,
                       @Param("memberId") Long memberId);

    @Modifying
    @Query("""
        UPDATE Task t
        SET t.assignedTo = NULL
        WHERE t.projectPhase.project.projectId = :projectId
          AND t.assignedTo.memberId = :memberId
    """)
    void deassignTasksForViewer(@Param("projectId") Long projectId,
                       @Param("memberId") Long memberId);


    @Query("""
   SELECT t FROM Task t
   WHERE t.projectPhase.project.projectId = :projectId
   AND t.status <> 'COMPLETED'
   ORDER BY ABS(t.endDate - CURRENT_DATE)
""")
    List<Task> findNearestEndDateOngoingTasks(
            @Param("projectId") Long projectId,
            Pageable pageable
    );

    @Query("""
   SELECT t FROM Task t
   WHERE t.projectPhase.project.projectId = :projectId
   AND t.status = 'COMPLETED'
   ORDER BY t.completedAt DESC\s
""")
    List<Task> findRecentlyCompletedTasks(
            @Param("projectId") Long projectId,
            Pageable pageable
    );

    //find all nearing deadline tasks for email and in-app notification
    @Query("""
SELECT t
FROM Task t
WHERE t.endDate BETWEEN CURRENT_DATE AND :targetDate
AND t.status <> 'COMPLETED'
AND t.assignedTo IS NOT NULL
""")
    List<Task> findTasksNearingDeadline(Date targetDate);

    //find all overdue tasks for email and in-app notification
    @Query("""
SELECT t
FROM Task t
WHERE t.endDate < CURRENT_DATE
AND t.status <> 'COMPLETED'
AND t.assignedTo IS NOT NULL
""")
    List<Task> findOverdueTasks();
}
