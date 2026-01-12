package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.security.core.parameters.P;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PhaseRepo extends JpaRepository<Phase,Long> {
    List<Phase> findAllByProject_ProjectId(Long projectProjectId);

    List<Phase> findAllByProject(Project project);

    Optional<Phase> findByPhaseIdAndProject_ProjectId(Long phaseId, Long projectProjectId);

    int countByProject_ProjectId(Long projectProjectId);

    @Modifying
    @Query("""
        UPDATE Phase p
        SET p.assignedTo = NULL
        WHERE p.project.projectId = :projectId
          AND p.assignedTo.memberId = :memberId
          AND p.status <> 'COMPLETED'
    """)
    void deassignPhases(@Param("projectId") Long projectId,
                       @Param("memberId") Long memberId);

}
