package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.ProjectTemplate;
import com.shantanu.projectstatustracker.models.ProjectTemplatePhase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectTemplatePhaseRepo extends JpaRepository<ProjectTemplatePhase,Long> {

    List<ProjectTemplatePhase> findAllByProjectTemplate(ProjectTemplate projectTemplate);
}
