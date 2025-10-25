package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.ProjectTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectTemplateRepo extends JpaRepository<ProjectTemplate,Long> {

}
