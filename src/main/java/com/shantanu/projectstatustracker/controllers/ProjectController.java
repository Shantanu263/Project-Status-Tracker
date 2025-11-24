package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.AddMemberRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectUpdateRequestDTO;
import com.shantanu.projectstatustracker.services.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/project")
public class ProjectController {
    private final ProjectService projectService;

    @GetMapping()
    public ResponseEntity<Object> getProjects(){
        return projectService.getProjects();
    }

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
        System.out.println(projectId);
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

    @PreAuthorize("@auth.isProjectHeadOfProject(#projectId) or @auth.isSuperAdmin()")
    @PostMapping("/{projectId}/project-members/add-user")
    public ResponseEntity<Object> addMemberToProjectUsingEmail(@PathVariable(name = "projectId") Long projectId,
                                                               @RequestBody AddMemberRequestDTO addMemberRequestDTO,
                                                               @RequestAttribute(name = "email") String email){
        return projectService.addMemberToProjectUsingEmail(projectId,addMemberRequestDTO,email);
    }

    @PreAuthorize("@auth.isProjectHeadOfProject(#projectId) or @auth.isSuperAdmin()")
    @DeleteMapping("/{projectId}/project-members/{userId}")
    public ResponseEntity<Object> deleteMemberFromProject(@PathVariable(name = "projectId") Long projectId,
                                                          @PathVariable(name = "userId") Long userId){
        return projectService.deleteMemberFromProject(projectId,userId);
    }

    @GetMapping("{projectId}/dashboard")
    public ResponseEntity<Object> getDashboardData(@PathVariable(name = "projectId") Long projectId){
        return projectService.getDashboardData(projectId);
    }

}
