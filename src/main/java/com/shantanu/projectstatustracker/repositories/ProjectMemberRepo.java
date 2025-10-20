package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.ProjectMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectMemberRepo extends JpaRepository<ProjectMember,Long> {

    List<ProjectMember> findAllByProject_ProjectId(Long projectProjectId);


    ProjectMember findByProject_ProjectIdAndUser_UserId(Long projectProjectId, Long userUserId);
}
