package com.shantanu.projectstatustracker.scheduled;

import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DeadlineChecker {

    private final ProjectRepo projectRepo;
    private final PhaseRepo phaseRepo;
    private final TaskRepo taskRepo;
    private final NotificationService notificationService;

    // Run every day at 8 AM
//    @Scheduled(cron = "0 0 8 * * *")
//    public void checkDeadlines() {
//        checkProjectDeadlines();
//        checkPhaseDeadlines();
//        checkTaskDeadlines();
//    }
//
//    private void checkProjectDeadlines() {
//        LocalDate today = LocalDate.now();
//        List<Project> projects = projectRepo.findAll();
//
//        for (Project project : projects) {
//            if (project.getEndDate() == null) continue;
//
//            if (project.getEndDate().isBefore(today) && !project.isCompleted()) {
//                for (User member : project.getMembers()) {
//                    notificationService.createNotification(
//                            member.getEmail(),
//                            "Project '" + project.getName() + "' is overdue."
//                    );
//                }
//            } else if (project.getEndDate().isEqual(today.plusDays(2))) {
//                notificationService.createNotification(
//                        project.getProjectHead().getEmail(),
//                        "Project '" + project.getName() + "' is nearing its deadline."
//                );
//            }
//        }
//    }
//
//    private void checkPhaseDeadlines() {
//        LocalDate today = LocalDate.now();
//        List<Phase> phases = phaseRepo.findAll();
//
//        for (Phase phase : phases) {
//            if (phase.getDeadline() == null || phase.getProject() == null) continue;
//
//            if (phase.getDeadline().isBefore(today) && phase.getProgress() < 100) {
//                Project project = phase.getProject();
//                for (User member : project.getMembers()) {
//                    notificationService.createNotification(
//                            member.getEmail(),
//                            "Phase '" + phase.getName() + "' in project '" +
//                                    project.getName() + "' is overdue."
//                    );
//                }
//            }
//        }
//    }
//
//    private void checkTaskDeadlines() {
//        LocalDate today = LocalDate.now();
//        List<Task> tasks = taskRepo.findAll();
//
//        for (Task task : tasks) {
//            if (task.getEndDate() == null || task.getAssignedTo() == null) continue;
//
//            if (task.getEndDate().isBefore(today) && !task.getStatus().equalsIgnoreCase("COMPLETED")) {
//                notificationService.createNotification(
//                        task.getAssignedTo().getEmail(),
//                        "Task '" + task.getTitle() + "' is overdue."
//                );
//
//                // Notify project head as well
//                if (task.getPhase() != null && task.getPhase().getProject() != null) {
//                    User head = task.getPhase().getProject().getProjectHead();
//                    notificationService.createNotification(
//                            head.getEmail(),
//                            "Task '" + task.getTitle() + "' in your project is overdue."
//                    );
//                }
//            } else if (task.getEndDate().isEqual(today.plusDays(1))) {
//                notificationService.createNotification(
//                        task.getAssignedTo().getEmail(),
//                        "Task '" + task.getTitle() + "' is due tomorrow."
//                );
//            }
//        }
//    }
}

