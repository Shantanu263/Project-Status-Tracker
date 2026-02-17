package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.*;
import com.shantanu.projectstatustracker.services.EmailService;
import com.shantanu.projectstatustracker.services.ProjectService;
import com.shantanu.projectstatustracker.services.impl.ProjectSummaryServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/project")
public class ProjectController {
    private final ProjectService projectService;
    private final ProjectSummaryServiceImpl projectSummaryService;
    private final EmailService emailService;


    @GetMapping()
    public ResponseEntity<Object> getProjects(){
        return projectService.getProjects();
    }

    @PreAuthorize("@auth.isSuperAdmin() or @auth.isAdmin()")
    @PostMapping()
    public ResponseEntity<Object> createProject(@RequestBody ProjectRequestDTO projectRequestDTO){
        return projectService.createProject(projectRequestDTO);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Object> getProjects(@PathVariable(name = "id") Long id){
        return projectService.getProjectById(id);
    }

    @PreAuthorize("@auth.canManageProject(#projectId) or @auth.isSuperAdmin()")
    @PutMapping("/{projectId}")
    public ResponseEntity<Object> updateProject(@PathVariable(name = "projectId") Long projectId, @RequestBody ProjectUpdateRequestDTO projectUpdateRequestDTO){
        return projectService.updateProject(projectId,projectUpdateRequestDTO);
    }

    @PreAuthorize("@auth.isSuperAdmin()")
    @DeleteMapping("/{id}")
    public ResponseEntity<Object> deleteProject(@PathVariable(name = "id") Long id){
        return projectService.deleteProject(id);
    }

    @GetMapping("/{id}/project-members")
    public ResponseEntity<Object> getProjectMembers(@PathVariable(name = "id") Long id){
        return projectService.getProjectMembers(id);
    }

    @GetMapping("/{id}/project-member/{memberId}")
    public ResponseEntity<Object> getProjectMemberById(@PathVariable(name = "id") Long id,
                                                    @PathVariable(name = "memberId") Long memberId){
        return projectService.getProjectMemberById(id, memberId);
    }

    @GetMapping("/{id}/get-project-members")
    public ResponseEntity<Object> getProjectMembersPaginated(@PathVariable(name = "id") Long id,
                                                             @RequestParam(value = "page", defaultValue = "0", required = false) int pageNumber,
                                                             @RequestParam(value = "size", defaultValue = "5", required = false) int pageSize,
                                                             @RequestParam(value = "sortBy", defaultValue = "id", required = false) String sortBy,
                                                             @RequestParam(value = "order", defaultValue = "asc", required = false) String order,
                                                             @RequestParam(value = "search", required = false) String search){
        return projectService.getProjectMembersPaginated(id,pageNumber,pageSize,sortBy,order,search);
    }

    @PostMapping("/{projectId}/project-members/{userId}")
    public ResponseEntity<Object> addMemberToProject(@PathVariable(name = "projectId") Long projectId,
                                                     @PathVariable(name = "userId") Long userId,
                                                     @RequestAttribute(name = "email") String email){
        return projectService.addMemberToProject(projectId,userId,email);
    }

    @PreAuthorize("@auth.isProjectAdminOfProject(#projectId) or @auth.isSuperAdmin()")
    @PostMapping("/{projectId}/project-members/add-user")
    public ResponseEntity<Object> addMemberToProjectUsingEmail(@PathVariable(name = "projectId") Long projectId,
                                                               @RequestBody AddMemberRequestDTO addMemberRequestDTO,
                                                               @RequestAttribute(name = "email") String email){
        return projectService.addMemberToProjectUsingEmail(projectId,addMemberRequestDTO,email);
    }

    @PatchMapping("/{projectId}/project-members/{projectMemberId}/role")
    public ResponseEntity<Object> updateRoleOfProjectMember(@PathVariable(name = "projectId") Long projectId,
                                                            @PathVariable(name = "projectMemberId") Long projectMemberId,
                                                            @RequestBody AddMemberRequestDTO addMemberRequestDTO){
        return projectService.updateRoleOfProjectMember(projectId,projectMemberId, addMemberRequestDTO.getRoleInProject());
    }

    @PreAuthorize("@auth.isProjectAdminOfProject(#projectId) or @auth.isSuperAdmin()")
    @DeleteMapping("/{projectId}/project-members/{memberId}")
    public ResponseEntity<Object> deleteMemberFromProject(@PathVariable(name = "projectId") Long projectId,
                                                          @PathVariable(name = "memberId") Long memberId){
        return projectService.removeProjectMember(projectId,memberId);
    }

    @GetMapping("{projectId}/dashboard")
    public ResponseEntity<Object> getDashboardData(@PathVariable(name = "projectId") Long projectId){
        return projectService.getDashboardData(projectId);
    }

    @GetMapping("projects-dashboard")
    public ResponseEntity<Object> getProjectsDashboard(){
        return projectService.getProjectsDashboard();
    }

    @PostMapping("/{projectId}/summary/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable Long projectId, @RequestBody ProjectSummaryRequestDTO dto) {
        String html = projectSummaryService.generateHtmlTemplate(projectId,dto);
        byte[] pdf = projectSummaryService.generatePdf(html);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=project-summary.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PostMapping("/{projectId}/summary/pdf/email")
    public ResponseEntity<Object> emailSummaryPdf(@PathVariable Long projectId, @RequestBody ProjectSummaryRequestDTO dto) {
        String html = projectSummaryService.generateHtmlTemplate(projectId,dto);
        byte[] pdf = projectSummaryService.generatePdf(html);

        if(dto.getEmail() != null) return projectSummaryService.generateMail(dto.getEmail(), projectId,pdf);
        else return new ResponseEntity<>(Map.of("message","email not found"), HttpStatus.NOT_FOUND);
    }

    @GetMapping("/{projectId}/timeline/export/csv")
    public ResponseEntity<Object> exportTimelineAsCsv(
            @PathVariable Long projectId,
            @RequestParam(required = false, name = "startDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date startDate,
            @RequestParam(required = false, name = "endDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) Date endDate
    ) {

        return projectService.generateTimelineCsv(projectId, startDate, endDate);

        //byte[] csvData = projectService.generateTimelineCsv(projectId, startDate, endDate);
    }

}
