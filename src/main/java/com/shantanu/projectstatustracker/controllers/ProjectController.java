package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.ProjectRequestDTO;
import com.shantanu.projectstatustracker.dtos.ProjectUpdateRequestDTO;
import com.shantanu.projectstatustracker.services.ProjectService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

    @PutMapping("/{id}")
    public ResponseEntity<Object> updateProject(@PathVariable(name = "id") Long id, @RequestBody ProjectUpdateRequestDTO projectUpdateRequestDTO){
        return projectService.updateProject(id,projectUpdateRequestDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Object> deleteProject(@PathVariable(name = "id") Long id){
        return projectService.deleteProject(id);
    }

    @GetMapping("/{id}/project-members")
    public ResponseEntity<Object> getProjectMembers(@PathVariable(name = "id") Long id){
        return projectService.getProjectMembers(id);
    }

    @PostMapping("/{projectId}/project-members/{userId}")
    public ResponseEntity<Object> addMemberToProject(@PathVariable(name = "projectId") Long projectId,
                                                     @PathVariable(name = "userId") Long userId,
                                                     @RequestAttribute(name = "email") String email){
        return projectService.addMemberToProject(projectId,userId,email);
    }

    @DeleteMapping("/{projectId}/project-members/{userId}")
    public ResponseEntity<Object> deleteMemberFromProject(@PathVariable(name = "projectId") Long projectId,
                                                          @PathVariable(name = "userId") Long userId){
        return projectService.deleteMemberFromProject(projectId,userId);
    }


}
