package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.dtos.NotificationResponseDTO;
import com.shantanu.projectstatustracker.dtos.mappers.NotificationMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.EmailService;
import com.shantanu.projectstatustracker.services.NotificationService;
import jakarta.mail.MessagingException;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepo notificationRepo;
    private final UserRepo userRepo;
    private final TaskRepo taskRepo;
    private final NotificationEmailRepo notificationEmailRepo;
    private final SubTaskRepo subTaskRepo;
    private final PhaseRepo phaseRepo;
    private final EmailService emailService;
    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);
    private final NotificationMapper notificationMapper;
    private final SimpMessagingTemplate messagingTemplate;

    Integer warningDays = 2;
    Date targetDate = Date.from(
            LocalDate.now()
                    .plusDays(warningDays)
                    .atStartOfDay(ZoneId.systemDefault())
                    .toInstant()
    );

    @Override
    public ResponseEntity<Object> getUserNotifications(Long userId, Pageable pageable) {
        List <Notification> notifications = notificationRepo.findByUser_UserIdOrderByCreatedAtDesc(userId, pageable).getContent().stream().toList();
        return ResponseEntity.ok(notificationMapper.mapNotificationsToResponse(notifications));
    }

    @Override
    public ResponseEntity<Object> markAsRead(Long notificationId) {
        Notification notification = notificationRepo.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setIsRead(true);
        notificationRepo.save(notification);
        return ResponseEntity.ok("Notification marked as read");
    }

    @Override
    @Transactional
    public ResponseEntity<Object> markAllAsRead(Long userId) {
        userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        notificationRepo.findByUser_UserIdAndIsRead(userId, false)
                .forEach(notification -> {
                    notification.setIsRead(true);
                    notificationRepo.save(notification);
                });

        return ResponseEntity.ok(Map.of("message","All notifications marked as read"));
    }

    @Override
    public ResponseEntity<Object> getUnreadCount(Long userId) {
        userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return ResponseEntity.ok(notificationRepo.countByUser_UserIdAndIsRead(userId,false));
    }

    @Override
    public void createNotification(User user, String title, String message, NotificationType type, Long entityId, EntityType entityType, Long projectId) {

        Notification notification = Notification.builder()
                .user(user)
                .title(title)
                .message(message)
                .type(type)
                .entityId(entityId)
                .entityType(entityType)
                .projectId(projectId)
                .build();

        notificationRepo.save(notification);

        NotificationResponseDTO dto = notificationMapper.mapNotificationToResponse(notification);

        messagingTemplate.convertAndSendToUser(
                user.getEmail(),   // must match the Principal name
                "/queue/notifications",
                dto
        );
    }

    @Override
    @Scheduled(cron = "10 57 15 * * ?") // every day
    public void checkDeadlinesAndNotify() {
        System.out.println("checking deadlines ....");
        List<Phase> nearDeadlinePhases = phaseRepo.findPhasesNearingDeadline(targetDate);
        List<Phase> overduePhases = phaseRepo.findOverduePhases();

        for (Phase phase : nearDeadlinePhases) {
            notifyPhases(phase, NotificationType.NEARING_DEADLINE);
            notifyDeadlineInApp(EntityType.PHASE, phase.getPhaseId(), phase.getPhaseName(), NotificationType.NEARING_DEADLINE, phase.getAssignedTo(), phase.getProject().getProjectId());
        }

        for (Phase phase : overduePhases) {
            notifyPhases(phase, NotificationType.OVERDUE);
            notifyDeadlineInApp(EntityType.PHASE, phase.getPhaseId(), phase.getPhaseName(), NotificationType.OVERDUE, phase.getAssignedTo(), phase.getProject().getProjectId());
        }

        List<Task> nearDeadlineTasks = taskRepo.findTasksNearingDeadline(targetDate);
        List<Task> overdueTasks = taskRepo.findOverdueTasks();

        for (Task task : nearDeadlineTasks) {
            notifyTasks(task, NotificationType.NEARING_DEADLINE);
            notifyDeadlineInApp(EntityType.TASK, task.getTaskId(), task.getTaskName(), NotificationType.NEARING_DEADLINE, task.getAssignedTo(), task.getProjectPhase().getProject().getProjectId());
        }

        for (Task task : overdueTasks) {
            notifyTasks(task, NotificationType.OVERDUE);
            notifyDeadlineInApp(EntityType.TASK, task.getTaskId(), task.getTaskName(), NotificationType.OVERDUE, task.getAssignedTo(), task.getProjectPhase().getProject().getProjectId());
        }

        //Subtask
        List<SubTask> nearDeadlineSubTasks = subTaskRepo.findSubTasksNearingDeadline(targetDate);
        List<SubTask> overdueSubTasks = subTaskRepo.findOverdueSubTasks();

        for (SubTask subTask : nearDeadlineSubTasks) {
            notifySubTasks(subTask, NotificationType.NEARING_DEADLINE);
            notifyDeadlineInApp(EntityType.SUBTASK, subTask.getSubTaskId(), subTask.getSubTaskName(), NotificationType.NEARING_DEADLINE, subTask.getAssignedTo(), subTask.getTask().getProjectPhase().getProject().getProjectId());
        }

        for (SubTask subTask : overdueSubTasks) {
            notifySubTasks(subTask, NotificationType.OVERDUE);
            notifyDeadlineInApp(EntityType.SUBTASK, subTask.getSubTaskId(), subTask.getSubTaskName(), NotificationType.OVERDUE, subTask.getAssignedTo(), subTask.getTask().getProjectPhase().getProject().getProjectId());
        }

        System.out.println("Deadlines checked");

    }

    private void notifyTasks(Task task, NotificationType type) {
        boolean alreadyEmailSent =
                notificationEmailRepo.existsByEntityIdAndEntityTypeAndNotificationTypeAndUser_UserId(
                        task.getTaskId(), EntityType.TASK, type, task.getAssignedTo().getUser().getUserId()
                );

        if (!alreadyEmailSent) {

            String htmlContent = emailService.getDeadlineEmail(
                    task.getAssignedTo().getUser().getName(),
                    task.getProjectPhase().getProject().getProjectName(),
                    task.getTaskName(),
                    EntityType.TASK.toString(),
                    task.getEndDate().toString(),
                    warningDays.toString(),
                    type);

            MailBody mailBody = MailBody.builder()
                    .to(task.getAssignedTo().getUser().getEmail())
                    .text(htmlContent)  // add HTML template
                    .subject("Task Update | ProjectHub")
                    .build();

            try{
                emailService.sendNotificationHtmlMessage(mailBody,true);
            } catch (MessagingException e){
                log.error("Failed to send email", e);
            }

            NotificationEmail notificationEmail = NotificationEmail.builder()
                    .entityType(EntityType.TASK)
                    .entityId(task.getTaskId())
                    .user(task.getAssignedTo().getUser())
                    .notificationType(type)
                    .build();

            notificationEmailRepo.save(notificationEmail);
        }
    }

    private void notifySubTasks(SubTask subTask, NotificationType type) {
        boolean alreadySent =
                notificationEmailRepo.existsByEntityIdAndEntityTypeAndNotificationTypeAndUser_UserId(
                        subTask.getSubTaskId(), EntityType.SUBTASK, type, subTask.getAssignedTo().getUser().getUserId()
                );

        if (!alreadySent) {

            String htmlContent = emailService.getDeadlineEmail(
                    subTask.getAssignedTo().getUser().getName(),
                    subTask.getTask().getProjectPhase().getProject().getProjectName(),
                    subTask.getSubTaskName(),
                    EntityType.SUBTASK.toString(),
                    subTask.getEndDate().toString(),
                    warningDays.toString(),
                    type);

            MailBody mailBody = MailBody.builder()
                    .to(subTask.getAssignedTo().getUser().getEmail())
                    .text(htmlContent)  // add HTML template
                    .subject("SubTask Update | ProjectHub")
                    .build();

            try{
                emailService.sendNotificationHtmlMessage(mailBody,true);
            } catch (MessagingException e){
                log.error("Failed to send email", e);
            }

            NotificationEmail notificationEmail = NotificationEmail.builder()
                    .entityType(EntityType.SUBTASK)
                    .entityId(subTask.getSubTaskId())
                    .user(subTask.getAssignedTo().getUser())
                    .notificationType(type)
                    .build();

            notificationEmailRepo.save(notificationEmail);
        }
    }

    private void notifyPhases(Phase phase, NotificationType type) {
        boolean alreadySent =
                notificationEmailRepo.existsByEntityIdAndEntityTypeAndNotificationTypeAndUser_UserId(
                        phase.getPhaseId(), EntityType.PHASE, type, phase.getAssignedTo().getUser().getUserId()
                );

        if (!alreadySent) {

            String htmlContent = emailService.getDeadlineEmail(
                    phase.getAssignedTo().getUser().getName(),
                    phase.getProject().getProjectName(),
                    phase.getPhaseName(),
                    EntityType.PHASE.toString(),
                    phase.getEndDate().toString(),
                    warningDays.toString(),
                    type);

            MailBody mailBody = MailBody.builder()
                    .to(phase.getAssignedTo().getUser().getEmail())
                    .text(htmlContent)  // add HTML template
                    .subject("Phase Update | ProjectHub")
                    .build();

            try{
                emailService.sendNotificationHtmlMessage(mailBody,true);
            } catch (MessagingException e){
                log.error("Failed to send email", e);
            }

            NotificationEmail notificationEmail = NotificationEmail.builder()
                    .entityType(EntityType.PHASE)
                    .entityId(phase.getPhaseId())
                    .user(phase.getAssignedTo().getUser())
                    .notificationType(type)
                    .build();

            notificationEmailRepo.save(notificationEmail);
        }
    }

    @Async
    protected void notifyDeadlineInApp(EntityType entityType,
                                       Long entityId, String entityName,
                                       NotificationType type, ProjectMember assignedTo, Long projectId) {

        boolean alreadyAppNotificationSent =
                notificationRepo.existsByEntityIdAndEntityTypeAndTypeAndUser_UserId(
                        entityId, entityType, type, assignedTo.getUser().getUserId()
                );

        if (!alreadyAppNotificationSent) {
            String title;
            String message;
            String entity = entityType.toString().charAt(0) + entityType.toString().substring(1).toLowerCase();
            if (type == NotificationType.NEARING_DEADLINE) {
                title = entity + " Deadline";
                message = "Your " + entity + ": " + entityName + " is due soon";
            }
            else {
                title = entity + " Overdue";
                message = "Your " + entity + ": " + entityName + " is overdue";
            }
            createNotification(
                    assignedTo.getUser(),
                    title,
                    message,
                    type,
                    entityId,
                    entityType,
                    projectId);
        }
    }

}
