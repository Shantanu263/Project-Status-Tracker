package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.AddMemberRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectUpdateRequestDTO;
import com.shantanu.projectstatustracker.dtos.RoleRequestDTO;
import com.shantanu.projectstatustracker.models.ProjectRole;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

public interface ProjectService {
    ResponseEntity<Object> getProjects();

    ResponseEntity<Object> createProject(ProjectRequestDTO projectRequestDTO);

    ResponseEntity<Object> getProjectById(Long id);

    ResponseEntity<Object> updateProject(Long id, ProjectUpdateRequestDTO projectUpdateRequestDTO);

    ResponseEntity<Object> deleteProject(Long id);

    ResponseEntity<Object> getProjectMembers(Long id);

    ResponseEntity<Object> addMemberToProject(Long projectId,Long userId, String email);

    ResponseEntity<Object> deleteMemberFromProject(Long projectId,Long userId);

    ResponseEntity<Object> addMemberToProjectUsingEmail(Long projectId, AddMemberRequestDTO addMemberRequestDTO, String assignedByEmail);

    ResponseEntity<Object> getProjectMemberById(Long id,Long memberId);

    ResponseEntity<Object> getProjectMembersPaginated(Long id, int pageNumber, int pageSize, String sortBy, String order, String search);

    ResponseEntity<Object> getDashboardData(Long projectId);

    ResponseEntity<Object> getProjectsDashboard();

    ResponseEntity<Object> updateRoleOfProjectMember(Long projectId, Long projectMemberId, ProjectRole projectRole);
}
