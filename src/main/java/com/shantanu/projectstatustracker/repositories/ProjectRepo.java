package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepo extends JpaRepository<Project,Long> {
    boolean existsByProjectName(String projectName);
}
