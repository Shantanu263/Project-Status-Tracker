package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.SubTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubTaskRepo extends JpaRepository<SubTask, Long> {

}
