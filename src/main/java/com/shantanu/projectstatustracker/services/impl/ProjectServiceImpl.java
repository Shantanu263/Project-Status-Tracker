package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.AddMemberRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectUpdateRequestDTO;
import com.shantanu.projectstatustracker.dtos.dashboard.*;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMapper;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMemberMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
    private final InvitedMembersRepo invitedMembersRepo;
    private final ProjectTemplateRepo projectTemplateRepo;
    private final PhaseRepo phaseRepo;
    private final TaskRepo taskRepo;
    private final HttpServletRequest request;
    private final ActivityLogService activityLogService;
    private final ActivityLogRepo activityLogRepo;

    @Override
    public ResponseEntity<Object> getProjects() {
        String role = (String) request.getAttribute("role");
        String email = (String) request.getAttribute("email");

        if (role == null || email == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid user context");
        }
        List<Project> projects;

        if (role.equalsIgnoreCase("SUPER_ADMIN")) {
            projects = projectRepo.findAll();
        } else {
            projects = projectRepo.findAllByMemberEmail(email);
        }

        return ResponseEntity.ok(projectMapper.mapProjects(projects));
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

        if (projectRequestDTO.getTemplateId() != null){
            ProjectTemplate projectTemplate = projectTemplateRepo.findById(projectRequestDTO.getTemplateId())
                    .orElseThrow(() -> new ResourceNotFoundException("Template does not exist"));

            project.setProjectTemplate(projectTemplate);

            List<Phase> clonedPhases = projectTemplate.getProjectTemplatePhases().stream().map(templatePhase -> {
                Phase phase = new Phase();
                phase.setPhaseName(templatePhase.getPhaseName());
                phase.setStatus("Not Started"); // Default status
                phase.setStartDate(project.getStartDate()); // start same as project
                phase.setEndDate(project.getEndDate());     // end same as project
                phase.setProject(project);
                return phase;
            }).toList();

            List<Phase> savedPhases = phaseRepo.saveAll(clonedPhases);
            project.setPhases(savedPhases);
            projectRepo.save(project);
        }

        ProjectMember projectMember = ProjectMember.builder()
                .project(project)
                .role(ProjectRole.PROJECT_HEAD)
                .user(userRepo.findById(projectRequestDTO.getProjectHeadId()).orElseThrow())
                .assignedBy(userRepo.findByName("Admin").orElseThrow(() -> new ResourceNotFoundException("Admin not found")))
                .build();

        ProjectMember admin = ProjectMember.builder()
                .project(project)
                .role(ProjectRole.SUPER_ADMIN)
                .user(userRepo.findByEmail((String) request.getAttribute("email")).orElseThrow())
                .assignedBy(userRepo.findByName("Admin").orElseThrow(() -> new ResourceNotFoundException("Admin not found")))
                .build();

        projectMemberRepo.save(projectMember);
        projectMemberRepo.save(admin);

        activityLogService.log(
                projectRepo.findByProjectName(project.getProjectName()).getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + "created Project " + projectRequestDTO.getProjectName()
        );

        return ResponseEntity.ok(Map.of("message","Project created successfully", "project", projectMapper.mapProjectResponse(project)));
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

        activityLogService.log(
                existingProject.getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + "updated Details of Project"
        );

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

        ProjectMember newMember = projectMemberMapper.mapRequestToProjectMember(project,user,assignedBy,ProjectRole.PROJECT_VIEWER);
        projectMemberRepo.save(newMember);

        return ResponseEntity.ok("User with id:"+userId+" added to project (id: "+projectId+")");
    }

    @Override
    public ResponseEntity<Object> deleteMemberFromProject(Long projectId, Long userId) {
        if (!projectRepo.existsById(projectId)) return ResponseEntity.ok(Map.of("message","Project does not exist"));
        User user = userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        ProjectMember member = projectMemberRepo.findByProject_ProjectIdAndUser_UserId(projectId,userId);
        projectMemberRepo.delete(member);

        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + "Removed member " + user.getName() + " from the project."
        );

        return ResponseEntity.ok(Map.of("message","Member removed"));
    }

    @Override
    public ResponseEntity<Object> addMemberToProjectUsingEmail(Long projectId, AddMemberRequestDTO addMemberRequestDTO, String assignedByEmail) {
        Project project = projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        User assignedBy = userRepo.findByEmail(assignedByEmail).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (userRepo.existsByEmail(addMemberRequestDTO.getEmail())) {
            User user  = userRepo.findByEmail(addMemberRequestDTO.getEmail())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            ProjectMember newMember = projectMemberMapper.mapRequestToProjectMember(project,user,assignedBy,addMemberRequestDTO.getRoleInProject());
            projectMemberRepo.save(newMember);

            activityLogService.log(
                    projectId,
                    (String) request.getAttribute("email"),
                    request.getAttribute("username") + "add new member " + user.getName() + " to the project."
            );
        }
        else {
            InvitedMembers member = InvitedMembers.builder()
                    .email(addMemberRequestDTO.getEmail())
                    .projectId(projectId)
                    .role(addMemberRequestDTO.getRoleInProject())
                    .assignedBy(assignedBy)
                    .build();

            invitedMembersRepo.save(member);

        }

        return ResponseEntity.ok("Member Invited");
    }

    @Override
    public ResponseEntity<Object> getProjectMembersPaginated(Long id, int pageNumber, int pageSize, String sortBy, String order, String search) {
        Sort sort = order.equalsIgnoreCase("desc") ?
                Sort.by(sortBy).descending() :
                Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(pageNumber, pageSize, sort);

        String searchValue = (search == null || search.isBlank()) ? "" : search;

        Page<ProjectMember> result = projectMemberRepo.searchProjectMembers(id, searchValue, pageable);

        return ResponseEntity.ok(toPaginatedResponse(result));
    }

    //GET DASHBOARD DATA
    @Override
    public ResponseEntity<Object> getDashboardData(Long projectId) {
        DashboardResponseDTO dto = new DashboardResponseDTO();
        Project project = projectRepo.findById(projectId).orElseThrow();

        // ----- BASIC COUNTS -----
        dto.setTotalTasks(taskRepo.countByProjectPhase_Project(project));
        dto.setCompletedTasks(taskRepo.countByProjectPhase_ProjectAndStatus(project,Status.DONE));
        dto.setPendingTasks(taskRepo.countByProjectPhase_ProjectAndStatus(project,Status.IN_PROGRESS));
        dto.setOverdueTasks(taskRepo.countOverdueTasks(projectId));

        dto.setTotalPhases(phaseRepo.countByProject_ProjectId(projectId));
        dto.setTotalMembers(projectMemberRepo.countByProject_ProjectId(projectId));
        dto.setAssignedTasks(taskRepo.countAssignedTasks(projectId));

        dto.setOverallProgress(project.getProgress());

        // ----- CHARTS -----
        dto.setTaskDistribution(
                taskRepo.getTaskDistribution(projectId).stream()
                        .map(r -> new LabelCountDTO(r[0].toString(), Long.parseLong(r[1].toString())))
                        .toList()
        );

        dto.setPriorityDistribution(
                taskRepo.getPriorityDistribution(projectId).stream()
                        .map(r -> new PriorityCountDTO(r[0].toString(), Long.parseLong(r[1].toString())))
                        .toList()
        );

        dto.setTasksOverTime(
                taskRepo.getCompletedTasksOverTime(projectId).stream()
                        .map(r -> new TasksOverTimeDTO(r[0].toString(), Long.parseLong(r[1].toString())))
                        .toList()
        );

        // ----- DEADLINES -----
        dto.setUpcomingDeadlines(
                taskRepo.findUpcomingDeadlines(projectId).stream()
                        .map(r -> new UpcomingDeadlineDTO(
                                r[0].toString(),
                                (Date) r[1],
                                r[2] != null ? r[2].toString() : "Unassigned",
                                ((Number) r[3]).longValue()
                        )).toList()
        );
        // ----- ACTIVITY LOG -----
        dto.setRecentActivity(
                activityLogRepo.findRecentActivity(projectId)
                        .stream()
                        .map(a -> new ActivityLogDTO(
                                a.getPerformedBy().getName(),
                                a.getMessage(),
                                activityLogService.timeAgo(a.getCreatedAt())
                        ))
                        .toList()
        );

        // ----- PHASES -----
        dto.setPhaseProgress(
                phaseRepo.findAllByProject_ProjectId(projectId).stream()
                        .map(p -> new PhaseProgressDTO(p.getPhaseName(), p.getProgress()))
                        .toList()
        );

        return ResponseEntity.ok(dto);

    }

    public Map<String, Object> toPaginatedResponse(Page<ProjectMember> page) {
        Map<String, Object> response = new HashMap<>();
        response.put("items", page.getContent().stream()
                .map(projectMemberMapper::mapProjectMember)
                .toList());
        response.put("currentPage", page.getNumber());
        response.put("totalItems", page.getTotalElements());
        response.put("totalPages", page.getTotalPages());
        response.put("pageSize", page.getSize());
        response.put("isLast", page.isLast());
        return response;

    }

}
