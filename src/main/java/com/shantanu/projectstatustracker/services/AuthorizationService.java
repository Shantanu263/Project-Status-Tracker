package com.shantanu.projectstatustracker.services;

public interface AuthorizationService {

    String getCurrentUserEmail();

    String getCurrentUsername();

    boolean canManageProject(Long projectId);

    boolean canManageTasks(Long projectId);

    boolean canViewProject(Long projectId);

    boolean isSuperAdmin();

    boolean isProjectHeadOfProject(Long projectId);

    boolean debugSpEL();

}
