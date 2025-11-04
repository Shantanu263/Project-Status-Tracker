package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.ProjectRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface ProjectMemberRepo extends JpaRepository<ProjectMember,Long> {

    List<ProjectMember> findAllByProject_ProjectId(Long projectProjectId);

    ProjectMember findByProject_ProjectIdAndUser_UserId(Long projectProjectId, Long userUserId);

    boolean existsByProject_ProjectIdAndUser_EmailAndRole(Long projectProjectId, String userEmail, ProjectRole role);

    boolean existsByProject_ProjectIdAndUser_Email(Long projectProjectId, String userEmail);

    boolean existsByProject_ProjectIdAndUser_EmailAndRoleIn(Long projectProjectId, String userEmail, Collection<ProjectRole> roles);

}
