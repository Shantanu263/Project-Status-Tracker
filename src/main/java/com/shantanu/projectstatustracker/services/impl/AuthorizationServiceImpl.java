package com.shantanu.projectstatustracker.services.impl;


import com.shantanu.projectstatustracker.models.ProjectRole;
import com.shantanu.projectstatustracker.repositories.ProjectMemberRepo;
import com.shantanu.projectstatustracker.services.AuthorizationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service("auth")
@RequiredArgsConstructor
public class AuthorizationServiceImpl implements AuthorizationService {

    private final ProjectMemberRepo memberRepo;
    private final HttpServletRequest request;

    @Override
    public String getCurrentUserEmail() {
        return (String) request.getAttribute("email");
    }

    @Override
    public String getCurrentUsername() {
        return (String) request.getAttribute("username");
    }

    @Override
    public boolean canManageProject(Long projectId) {
        String email = getCurrentUserEmail();
        System.out.println(email+"can manageProject");
        if (email == null) return false;
        System.out.println(memberRepo.existsByProject_ProjectIdAndUser_EmailAndRole(
                projectId,email,ProjectRole.PROJECT_HEAD));
        return memberRepo.existsByProject_ProjectIdAndUser_EmailAndRole(
                projectId,email,ProjectRole.PROJECT_HEAD);
    }

    @Override
    public boolean canManageTasks(Long projectId) {
        String email = getCurrentUserEmail();
        if (email == null) return false;
        return memberRepo.existsByProject_ProjectIdAndUser_EmailAndRoleIn(
                projectId, email, List.of(ProjectRole.PROJECT_HEAD, ProjectRole.PROJECT_HANDLER));
    }

    @Override
    public boolean canViewProject(Long projectId) {
        String email = getCurrentUserEmail();
        if (email == null) return false;
        return memberRepo.existsByProject_ProjectIdAndUser_Email(projectId,email);
    }

    @Override
    public boolean isSuperAdmin() {
        String email = getCurrentUserEmail();
        if (email == null) return false;

        return (request.getAttribute("role").equals("SUPER ADMIN"));
    }

    @Override
    public boolean isProjectHeadOfProject(Long projectId) {
        String email = getCurrentUserEmail();
        if (email == null) return false;

        return memberRepo.existsByProject_ProjectIdAndUser_EmailAndRole(projectId,email,ProjectRole.PROJECT_HEAD);
    }

    @Override
    public boolean debugSpEL() {
        System.out.println("SpEL reached the AuthorizationServiceImpl!");
        return true;
    }

}

