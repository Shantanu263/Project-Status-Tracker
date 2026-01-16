package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.AddMemberRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectUpdateRequestDTO;
import com.shantanu.projectstatustracker.dtos.dashboard.*;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMapper;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMemberMapper;
import com.shantanu.projectstatustracker.dtos.superDashboard.DashboardSummaryDTO;
import com.shantanu.projectstatustracker.dtos.superDashboard.ProjectProgressBucketDTO;
import com.shantanu.projectstatustracker.dtos.superDashboard.ProjectRadarChartDTO;
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
import org.springframework.transaction.annotation.Transactional;

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
    private final SubTaskRepo subTaskRepo;

    @Override
    public ResponseEntity<Object> getProjects() {
        String role = (String) request.getAttribute("role");
        String email = (String) request.getAttribute("email");

        if (role == null || email == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid user context");
        }
        List<Project> projects;

        if (role.equalsIgnoreCase("SUPER ADMIN")) {
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
                .status("ongoing")
                .progress(0.00)
                .createdBySuperAdmin(userRepo.findByName("Admin")
                        .orElseThrow(() -> new ResourceNotFoundException("Admin not found")))
                .build();

        projectRepo.save(project);

        if (projectRequestDTO.getTemplateId() != null){
            ProjectTemplate projectTemplate = projectTemplateRepo.findById(projectRequestDTO.getTemplateId())
                    .orElseThrow(() -> new ResourceNotFoundException("Template does not exist"));

            //need to remove this
            project.setProjectTemplate(projectTemplate);

            List<Phase> clonedPhases = projectTemplate.getProjectTemplatePhases().stream().map(templatePhase -> {
                Phase phase = new Phase();
                phase.setPhaseName(templatePhase.getPhaseName());
                phase.setStatus(PhaseStatus.TO_DO); // Default status
                phase.setStartDate(project.getStartDate()); // start same as project
                phase.setEndDate(project.getEndDate());     // end same as project
                phase.setProject(project);
                return phase;
            }).toList();

            List<Phase> savedPhases = phaseRepo.saveAll(clonedPhases);
            project.setPhases(savedPhases);
            projectRepo.save(project);
        }

        //assigned by not required
        ProjectMember admin = ProjectMember.builder()
                .project(project)
                .role(ProjectRole.SUPER_ADMIN)
                .user(userRepo.findByEmail((String) request.getAttribute("email")).orElseThrow(() -> new ResourceNotFoundException("User not found")))
//                .assignedBy(userRepo.findByName("Admin").orElseThrow(() -> new ResourceNotFoundException("Admin not found")))
                .build();

        projectMemberRepo.save(admin);

        Long projectId = projectRepo.findByProjectName(project.getProjectName()).getProjectId();
        activityLogService.log(
                projectId,
                (String) request.getAttribute("email"),
                request.getAttribute("username") + "created Project " + projectRequestDTO.getProjectName(),
                EntityType.PROJECT,
                projectId
        );

        return ResponseEntity.ok(projectMapper.mapProjectResponse(project));
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

//        existingProject.setProjectName(projectUpdateRequestDTO.getProjectName());
//        existingProject.setDescription(projectUpdateRequestDTO.getDescription());
//        existingProject.setStartDate(projectUpdateRequestDTO.getStartDate());
//        existingProject.setEndDate(projectUpdateRequestDTO.getEndDate());
//        existingProject.setPriority(projectUpdateRequestDTO.getPriority());
//        existingProject.setStatus(projectUpdateRequestDTO.getStatus());

        projectMapper.updateProjectFromDTO(projectUpdateRequestDTO,existingProject);

        projectRepo.save(existingProject);

        activityLogService.log(
                existingProject.getProjectId(),
                (String) request.getAttribute("email"),
                request.getAttribute("username") + "updated Details of Project",
                EntityType.PROJECT,
                existingProject.getProjectId()
        );

        return ResponseEntity.ok(existingProject);

    }

    @Override
    public ResponseEntity<Object> deleteProject(Long id) {
        projectRepo.deleteById(id);

        return ResponseEntity.ok(Map.of("message","Project with Id:"+id+" Deleted"));
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
                request.getAttribute("username") + "Removed member " + user.getName() + " from the project.",
                EntityType.PROJECT,
                projectId
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
                    request.getAttribute("username") + "add new member " + user.getName() + " to the project.",
                    EntityType.PROJECT,
                    projectId
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

        return ResponseEntity.ok(Map.of("message","Member Invited"));
    }

    @Override
    public ResponseEntity<Object> getProjectMemberById(Long id, Long memberId) {
        projectRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        return ResponseEntity.ok(projectMemberMapper.mapProjectMember(projectMemberRepo.findById(memberId).orElseThrow(() -> new ResourceNotFoundException("Member not found"))));
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
        Pageable pageable = PageRequest.of(0, 8);

        dto.setRecentActivity(
                activityLogRepo.findRecentActivity(projectId, pageable)
                        .getContent()
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

    @Override
    public ResponseEntity<Object> getProjectsDashboard() {
        User user = userRepo.findByEmail((String) request.getAttribute("email"))
                .orElseThrow(() -> new ResourceNotFoundException("User not Found"));

        Long userId = request.getAttribute("role").equals("SUPER ADMIN")? null : user.getUserId();

        DashboardSummaryDTO dashboard = new DashboardSummaryDTO();

        // KPI Cards
        dashboard.setTotalProjects(projectRepo.countTotalProjects(userId));

        dashboard.setActiveProjects(projectRepo.countByStatus("ongoing", userId));

        dashboard.setCompletedProjects(projectRepo.countByStatus("COMPLETED", userId));

        dashboard.setDelayedProjects(projectRepo.countDelayedProjects(userId));

        dashboard.setAverageProgress(projectRepo.getAverageProjectProgress(userId));

        // Project Cards
        dashboard.setProjectCardDTOS(projectRepo.getProjectCardData(userId));

        // Charts
        dashboard.setProjectStatusChart(projectRepo.getProjectStatusDistribution(userId));

        dashboard.setProjectRadarChart(buildRadarChart(userId));

        dashboard.setProjectPriorityChart(projectRepo.getProjectPriorityDistribution(userId));

        List<ProjectProgressBucketDTO> buckets =
                projectRepo.getProjectProgressDistributionNative(userId)
                        .stream()
                        .map(row -> new ProjectProgressBucketDTO(
                                (String) row[0],
                                ((Number) row[1]).longValue()
                        ))
                        .toList();

        dashboard.setProjectProgressChart(buckets);

        return ResponseEntity.ok(dashboard);

    }

    @Override
    public ResponseEntity<Object> updateRoleOfProjectMember(Long projectId, Long projectMemberId, ProjectRole projectRole) {
        if (!projectRepo.existsById(projectId)) return ResponseEntity.ok(Map.of("message","Project does not exist"));

        ProjectMember projectMember = projectMemberRepo.findById(projectMemberId)
                .orElseThrow(() -> new ResourceNotFoundException("Project Member not found"));

        projectMember.setRole(projectRole);

        projectMemberRepo.save(projectMember);
        return ResponseEntity.ok(Map.of("message","Project Role Updated Successfully"));
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

    @Override
    @Transactional
    public ResponseEntity<Object> removeProjectMember(Long projectId, Long memberId) {

        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project Not found"));

        ProjectMember member = projectMemberRepo.findById(memberId)
                .orElseThrow(() -> new ResourceNotFoundException("User is not an active member of this project"));

//        if (member.getRole().equals(ProjectRole.SUPER_ADMIN)){
//            if (member.getUser().getRole().getName().equals("ADMIN")){
//
//            }
//        }

        //De-assign active tasks
        taskRepo.deassignTasks(projectId, memberId);

        //De-assign active subtasks
        subTaskRepo.deassignSubtasks(projectId, memberId);

        //Remove phase ownership
        phaseRepo.deassignPhases(projectId, memberId);

        //Soft-remove project membership
        member.setIsActive(false);

        projectMemberRepo.save(member);

        //(Optional) Activity log
        //activityLogService.logMemberRemoved(projectId, userId);
        return ResponseEntity.ok(Map.of("message","Project Member Removed successfully"));
    }

//    private boolean isLastProjectHead(Long projectId) {
//        // Implement count check
//        return false;
//    }


    private List<ProjectRadarChartDTO> buildRadarChart(Long userId) {

        List<ProjectRadarChartDTO> radar = new ArrayList<>();

        radar.add(new ProjectRadarChartDTO(
                "Task Completion",
                projectRepo.getTaskCompletionScore(userId)
        ));

        radar.add(new ProjectRadarChartDTO(
                "Schedule Adherence",
                projectRepo.getScheduleAdherenceScore(userId)
        ));

        radar.add(new ProjectRadarChartDTO(
                "Risk Level",
                projectRepo.getRiskScore(userId)
        ));

        radar.add(new ProjectRadarChartDTO(
                "Progress Consistency",
                projectRepo.getProgressConsistencyScore(userId)
        ));

        return radar;
    }

}
