package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.SubTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubTaskRepo extends JpaRepository<SubTask, Long> {

    Optional<SubTask> findBySubTaskIdAndTask_TaskId(Long subTaskId, Long taskTaskId);

    List<SubTask> findByTask_TaskId(Long taskTaskId);
}
