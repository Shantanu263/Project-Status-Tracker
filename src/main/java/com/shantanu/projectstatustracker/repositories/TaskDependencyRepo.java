package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Task;
import com.shantanu.projectstatustracker.models.TaskDependency;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskDependencyRepo extends JpaRepository<TaskDependency, Long> {

    List<TaskDependency> findByPredecessor(Task predecessor);

    List<TaskDependency> findBySuccessor(Task successor);

    boolean existsByPredecessorAndSuccessor(Task predecessor, Task successor);

    Optional<TaskDependency> findByIdAndPhase_PhaseId(Long id, Long phaseId);

    List<TaskDependency> findByPhase_PhaseId(Long phasePhaseId);
}