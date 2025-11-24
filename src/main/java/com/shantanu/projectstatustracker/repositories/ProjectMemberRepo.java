package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.ProjectRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    @Query("""
       SELECT pm FROM ProjectMember pm\s
       WHERE pm.project.projectId = :projectId\s
         AND (
              LOWER(pm.user.name) LIKE LOWER(CONCAT('%', :search, '%'))
              OR LOWER(pm.user.email) LIKE LOWER(CONCAT('%', :search, '%'))
              OR LOWER(pm.role) LIKE LOWER(CONCAT('%', :search, '%'))
         )
      \s""")
    Page<ProjectMember> searchProjectMembers(
            @Param("projectId") Long projectId,
            @Param("search") String search,
            Pageable pageable
    );

    int countByProject_ProjectId(Long projectProjectId);
}
