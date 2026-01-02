package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.dtos.superDashboard.*;
import com.shantanu.projectstatustracker.models.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepo extends JpaRepository<Project,Long> {
    boolean existsByProjectName(String projectName);

    @Query("SELECT p FROM Project p JOIN p.projectMembers m WHERE m.user.email = :email")
    List<Project> findAllByMemberEmail(@Param("email") String email);

    Project findByProjectName(String projectName);

    @Query("""
SELECT COUNT(DISTINCT p.projectId)
FROM Project p
LEFT JOIN p.projectMembers pm
WHERE (:userId IS NULL OR pm.user.userId = :userId)
""")
    long countTotalProjects(@Param("userId") Long userId);

    @Query("""
SELECT COUNT(DISTINCT p.projectId)
FROM Project p
LEFT JOIN p.projectMembers pm
WHERE p.status = :status
AND (:userId IS NULL OR pm.user.userId = :userId)
""")
    long countByStatus(@Param("status") String status,
                       @Param("userId") Long userId);


    @Query("""
SELECT COUNT(DISTINCT p.projectId)
FROM Project p
LEFT JOIN p.projectMembers pm
WHERE p.endDate < CURRENT_DATE
AND p.status <> 'COMPLETED'
AND (:userId IS NULL OR pm.user.userId = :userId)
""")
    long countDelayedProjects(@Param("userId") Long userId);


    @Query("""
SELECT COALESCE(AVG(ph.progress), 0)
FROM Project p
LEFT JOIN p.projectMembers pm
LEFT JOIN p.phases ph
WHERE (:userId IS NULL OR pm.user.userId = :userId)
""")
    double getAverageProjectProgress(@Param("userId") Long userId);


    @Query("""
SELECT new com.shantanu.projectstatustracker.dtos.superDashboard.ProjectCardDTO(
    p.projectId,
    p.projectName,
    p.status,
    COALESCE(AVG(ph.progress), 0),
    p.startDate,
    p.endDate,
    COUNT(DISTINCT ph.phaseId),
    COUNT(DISTINCT t.taskId),
    SUM(CASE\s
        WHEN t.endDate < CURRENT_DATE AND t.status <> 'DONE'\s
        THEN 1 ELSE 0\s
    END)
)
FROM Project p
LEFT JOIN p.projectMembers pm
LEFT JOIN p.phases ph
LEFT JOIN ph.tasks t
WHERE (:userId IS NULL OR pm.user.userId = :userId)
GROUP BY p.projectId
""")
    List<ProjectCardDTO> getProjectCardData(@Param("userId") Long userId);


    @Query("""
SELECT new com.shantanu.projectstatustracker.dtos.superDashboard.ProjectStatusChartDTO(
    p.status,
    COUNT(DISTINCT p.projectId)
)
FROM Project p
LEFT JOIN p.projectMembers pm
WHERE (:userId IS NULL OR pm.user.userId = :userId)
GROUP BY p.status
""")
    List<ProjectStatusChartDTO> getProjectStatusDistribution(@Param("userId") Long userId);


    @Query("""
SELECT new com.shantanu.projectstatustracker.dtos.superDashboard.ProjectProgressChartDTO(
    p.projectId,
    p.projectName,
    COALESCE(AVG(ph.progress), 0)
)
FROM Project p
LEFT JOIN p.projectMembers pm
LEFT JOIN p.phases ph
WHERE (:userId IS NULL OR pm.user.userId = :userId)
GROUP BY p.projectId, p.projectName
""")
    List<ProjectProgressChartDTO> getProjectProgressChart(@Param("userId") Long userId);

    @Query("""
SELECT
CASE
    WHEN COUNT(t) = 0 THEN 0
    ELSE (SUM(CASE WHEN t.status = 'DONE' THEN 1 ELSE 0 END) * 100.0) / COUNT(t)
END
FROM Project p
LEFT JOIN p.projectMembers pm
LEFT JOIN p.phases ph
LEFT JOIN ph.tasks t
WHERE (:userId IS NULL OR pm.user.userId = :userId)
""")
    double getTaskCompletionScore(Long userId);


    @Query("""
SELECT
CASE
    WHEN COUNT(t) = 0 THEN 100
    ELSE 100.0 -
        ((SUM(CASE
            WHEN t.endDate < CURRENT_DATE AND t.status <> 'DONE' THEN 1
            ELSE 0
        END) * 100.0) / COUNT(t))
END
FROM Project p
LEFT JOIN p.projectMembers pm
LEFT JOIN p.phases ph
LEFT JOIN ph.tasks t
WHERE (:userId IS NULL OR pm.user.userId = :userId)
""")
    double getScheduleAdherenceScore(Long userId);

    @Query("""
SELECT
CASE
    WHEN COUNT(p) = 0 THEN 100
    ELSE 100.0 -
        ((SUM(CASE
            WHEN p.endDate < CURRENT_DATE AND p.status <> 'COMPLETED' THEN 1
            ELSE 0
        END) * 100.0) / COUNT(p))
END
FROM Project p
LEFT JOIN p.projectMembers pm
WHERE (:userId IS NULL OR pm.user.userId = :userId)
""")
    double getRiskScore(Long userId);

    @Query("""
SELECT COALESCE(AVG(ph.progress), 0)
FROM Project p
LEFT JOIN p.projectMembers pm
LEFT JOIN p.phases ph
WHERE (:userId IS NULL OR pm.user.userId = :userId)
""")
    double getProgressConsistencyScore(Long userId);

    @Query("""
SELECT new com.shantanu.projectstatustracker.dtos.superDashboard.ProjectPriorityChartDTO(
    p.priority,
    COUNT(DISTINCT p.projectId)
)
FROM Project p
LEFT JOIN p.projectMembers pm
WHERE (:userId IS NULL OR pm.user.userId = :userId)
GROUP BY p.priority
""")
    List<ProjectPriorityChartDTO> getProjectPriorityDistribution(Long userId);

    @Query(value = """
SELECT
    bucket AS rangeLabel,
    COUNT(*) AS projectCount
FROM (
    SELECT
        p.project_id,
        COALESCE(AVG(ph.progress), 0) AS avg_progress,
        CASE
            WHEN COALESCE(AVG(ph.progress), 0) BETWEEN 0 AND 20 THEN '0–20%'
            WHEN COALESCE(AVG(ph.progress), 0) BETWEEN 21 AND 40 THEN '21–40%'
            WHEN COALESCE(AVG(ph.progress), 0) BETWEEN 41 AND 60 THEN '41–60%'
            WHEN COALESCE(AVG(ph.progress), 0) BETWEEN 61 AND 80 THEN '61–80%'
            ELSE '81–100%'
        END AS bucket
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_project_id = p.project_id
    LEFT JOIN phase ph ON ph.project_id = p.project_id
    WHERE (:userId IS NULL OR pm.user_user_id = :userId)
    GROUP BY p.project_id
) t
GROUP BY bucket
ORDER BY bucket
""", nativeQuery = true)
    List<Object[]> getProjectProgressDistributionNative(Long userId);

}
