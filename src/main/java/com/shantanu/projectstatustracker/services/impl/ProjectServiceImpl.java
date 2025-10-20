package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.ProjectMemberResponseDTO;
import com.shantanu.projectstatustracker.dtos.ProjectRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectUpdateRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMapper;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMemberMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.ProjectMember;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.ProjectMemberRepo;
import com.shantanu.projectstatustracker.repositories.ProjectRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.*;

@RequiredArgsConstructor
@Service
public class ProjectServiceImpl implements ProjectService {
    private final ProjectRepo projectRepo;
    private final ProjectMemberRepo projectMemberRepo;
    private final UserRepo userRepo;
    private final ProjectMapper projectMapper;
    private final ProjectMemberMapper projectMemberMapper;

    @Override
    public ResponseEntity<Object> getProjects() {
        return ResponseEntity.ok(projectMapper.mapProjects(projectRepo.findAll()));
    }

    @Override
    public ResponseEntity<Object> createProject(ProjectRequestDTO projectRequestDTO) {

        if (projectRepo.existsByProjectName(projectRequestDTO.getProjectName())) {
            return new ResponseEntity<>(Map.of("message","A project with this name already exists!"),
                    HttpStatus.BAD_REQUEST);
        }

        Project project = Project.builder()
                .projectName(projectRequestDTO.getProjectName())
                .startDate(projectRequestDTO.getStartDate())
                .endDate(projectRequestDTO.getEndDate())
                .priority(projectRequestDTO.getPriority())
                .projectHead(userRepo.findById(projectRequestDTO.getProjectHeadId())
                        .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + projectRequestDTO.getProjectHeadId())))
                .status("ongoing")
                .progress(0.00)
                .createdBySuperAdmin(userRepo.findByName("Admin")
                        .orElseThrow(() -> new ResourceNotFoundException("Admin not found")))
                .build();

        projectRepo.save(project);

        ProjectMember projectMember = ProjectMember.builder()
                .project(project)
                .role("PROJECT HEAD")
                .user(userRepo.findById(projectRequestDTO.getProjectHeadId()).orElseThrow())
                .assignedBy(userRepo.findByName("Admin").orElseThrow(() -> new ResourceNotFoundException("Admin not found")))
                .build();

        projectMemberRepo.save(projectMember);

        return ResponseEntity.ok(Map.of("message","Project created successfully"));
    }

    @Override
    public ResponseEntity<Object> getProjectById(Long id) {
        Project project = projectRepo.findById(id)
                .orElseThrow(()-> new ResourceNotFoundException("Project with id: " + id + " not found"));

        return ResponseEntity.ok(projectMapper.mapProjectResponse(project));
    }

    @Override
    public ResponseEntity<Object> updateProject(Long id, ProjectUpdateRequestDTO projectUpdateRequestDTO) {
        Project existingProject = projectRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        existingProject.setProjectName(projectUpdateRequestDTO.getProjectName());
        existingProject.setDescription(projectUpdateRequestDTO.getDescription());
        existingProject.setStartDate(projectUpdateRequestDTO.getStartDate());
        existingProject.setEndDate(projectUpdateRequestDTO.getEndDate());
        existingProject.setPriority(projectUpdateRequestDTO.getPriority());
        existingProject.setStatus(projectUpdateRequestDTO.getStatus());

        projectRepo.save(existingProject);
        return ResponseEntity.ok("project updated");

    }

    @Override
    public ResponseEntity<Object> deleteProject(Long id) {
        projectRepo.deleteById(id);
        return ResponseEntity.ok("Project with Id:"+id+" Deleted");
    }

    @Override
    public ResponseEntity<Object> getProjectMembers(Long id) {
        List<ProjectMember> projectMembers = projectMemberRepo.findAllByProject_ProjectId(id);
        return ResponseEntity.ok(projectMemberMapper.mapProjectMembers(projectMembers));
    }

    @Override
    public ResponseEntity<Object> addMemberToProject(Long projectId, Long userId, String email) {
        Project project = projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        User user = userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        User assignedBy = userRepo.findByEmail(email).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        ProjectMember newMember = projectMemberMapper.mapResponseToProjectMember(project,user,assignedBy);
        projectMemberRepo.save(newMember);
        return ResponseEntity.ok("User with id:"+userId+" added to project (id: "+projectId+")");
    }

    @Override
    public ResponseEntity<Object> deleteMemberFromProject(Long projectId, Long userId) {
        Project project = projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        User user = userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        ProjectMember member = projectMemberRepo.findByProject_ProjectIdAndUser_UserId(projectId,userId);

        projectMemberRepo.delete(member);
        return ResponseEntity.ok("Member removed");
    }

}
