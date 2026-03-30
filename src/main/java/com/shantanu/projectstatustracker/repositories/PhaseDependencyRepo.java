package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.PhaseDependency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PhaseDependencyRepo extends JpaRepository<PhaseDependency,Long> {
    List<PhaseDependency> findByPredecessor(Phase predecessor);

    List<PhaseDependency> findBySuccessor(Phase successor);

    boolean existsByPredecessorAndSuccessor(Phase predecessor, Phase successor);

    Optional<PhaseDependency> findByIdAndProject_ProjectId(Long id, Long projectProjectId);

    List<PhaseDependency> findByProject_ProjectId(Long projectProjectId);
}
