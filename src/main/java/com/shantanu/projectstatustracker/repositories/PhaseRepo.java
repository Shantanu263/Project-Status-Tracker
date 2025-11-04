package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.security.core.parameters.P;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PhaseRepo extends JpaRepository<Phase,Long> {
    List<Phase> findAllByProject_ProjectId(Long projectProjectId);

    List<Phase> findAllByProject(Project project);

    Optional<Phase> findByPhaseIdAndProject_ProjectId(Long phaseId, Long projectProjectId);

}
