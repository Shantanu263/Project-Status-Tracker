package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.models.InvitedUsers;
import jakarta.mail.MessagingException;

public interface EmailService {
    void sendSimpleMessage(MailBody mailBody);
    void sendHtmlMessage(MailBody mailBody) throws MessagingException;
    String getOtpEmailTemplate(String userName, String otp);
    String getAccountCreationEmailTemplate(String userName, String email);
    String getInviteUserEmailTemplate(InvitedUsers invitedUser, String inviterName);
    void sendHtmlMessageAsync(MailBody mailBody);
}
