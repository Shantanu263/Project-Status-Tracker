package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepo extends JpaRepository<Project,Long> {
    boolean existsByProjectName(String projectName);

    @Query("SELECT p FROM Project p JOIN p.projectMembers m WHERE m.user.email = :email")
    List<Project> findAllByMemberEmail(@Param("email") String email);

    List<Project> findAllByProjectMembers(List<ProjectMember> projectMembers);
}
