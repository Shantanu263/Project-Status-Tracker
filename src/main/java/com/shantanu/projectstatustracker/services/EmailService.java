package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.models.InvitedUsers;
import com.shantanu.projectstatustracker.models.NotificationType;
import jakarta.mail.MessagingException;

public interface EmailService {

    void sendSimpleMessage(MailBody mailBody);

    void sendHtmlMessage(MailBody mailBody) throws MessagingException;

    String getOtpEmailTemplate(String userName, String otp);

    String getAccountCreationEmailTemplate(String userName, String email);

    String getInviteUserEmailTemplate(InvitedUsers invitedUser, String inviterName);

    void sendHtmlMessageAsync(MailBody mailBody) throws MessagingException;

    void sendCriticalHtmlMessage(MailBody mailBody, boolean isAsync) throws MessagingException;

    void sendNotificationHtmlMessage(MailBody mailBody, boolean isAsync) throws MessagingException;

    void sendSummaryEmail(MailBody mailBody, byte[] pdfAttachment) throws MessagingException;

    String getProjectSummaryEmailTemplate(String recipientEmail, String senderName, String senderEmail, String projectName);

    String getDeadlineEmail(String username, String projectName, String entityName, String entityType, String endDate, String delay, NotificationType type);

}
