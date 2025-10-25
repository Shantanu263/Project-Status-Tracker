package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TaskRepo extends JpaRepository<Task,Long> {

}
