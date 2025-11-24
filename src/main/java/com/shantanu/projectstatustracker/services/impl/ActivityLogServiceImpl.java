package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.models.ActivityLog;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.ActivityLogRepo;
import com.shantanu.projectstatustracker.repositories.ProjectRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;


@Service
@RequiredArgsConstructor
public class ActivityLogServiceImpl implements ActivityLogService {

    private final ActivityLogRepo activityLogRepo;
    private final UserRepo userRepo;
    private final ProjectRepo projectRepo;

    @Override
    public void log(Long projectId, String email, String message) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        activityLogRepo.save(ActivityLog.builder()
                .project(project)
                .performedBy(user)
                .message(message)
                .createdAt(new Timestamp(System.currentTimeMillis()))
                .build());
    }

}

