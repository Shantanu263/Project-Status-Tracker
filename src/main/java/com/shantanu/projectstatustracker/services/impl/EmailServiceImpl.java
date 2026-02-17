package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.globalExceptionHandlers.DisabledException;
import com.shantanu.projectstatustracker.models.InvitedUsers;
import com.shantanu.projectstatustracker.models.NotificationType;
import com.shantanu.projectstatustracker.models.Task;
import com.shantanu.projectstatustracker.services.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Date;


@RequiredArgsConstructor
@Service
public class EmailServiceImpl implements EmailService {
    private final JavaMailSender javaMailSender;
    private static final Logger log = LoggerFactory.getLogger(EmailServiceImpl.class);

    @Value("${app.notification-mail.enabled:true}")
    private boolean notificationMailEnabled;

    @Value("${app.critical-mail.enabled:true}")
    private boolean criticalMailEnabled;

    @Value("${spring.mail.username}")
    String myEmailId;

    @Override
    public void sendSimpleMessage(MailBody mailBody){
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(mailBody.to());
        message.setFrom(myEmailId);
        message.setSubject(mailBody.subject());
        message.setText(mailBody.text());

        javaMailSender.send(message);
    }

    @Override
    public void sendHtmlMessage(MailBody mailBody) throws MessagingException {
        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setTo(mailBody.to());
        helper.setFrom(myEmailId);
        helper.setSubject(mailBody.subject());
        helper.setText(mailBody.text(), true); // true indicates HTML content

        javaMailSender.send(message);
    }

    @Override
    public void sendCriticalHtmlMessage(MailBody mailBody, boolean isAsync) throws MessagingException {
        //check if mail enabled
        if (!criticalMailEnabled) {
            log.info("Critical Mail sending is disabled. Skipping email to {}", mailBody.to());
            throw new DisabledException("Critical Email service disabled. Email not sent");
        }
        if (!isAsync)sendHtmlMessage(mailBody);
        else sendHtmlMessageAsync(mailBody);
    }

    @Override
    public void sendNotificationHtmlMessage(MailBody mailBody, boolean isAsync) throws MessagingException {
        if (!notificationMailEnabled) {
            log.info("Notification Mail sending is disabled. Skipping email to {}", mailBody.to());
            return;
        }
        if (!isAsync)sendHtmlMessage(mailBody);
        else sendHtmlMessageAsync(mailBody);
    }

    @Async
    public void sendHtmlMessageAsync(MailBody mailBody) throws MessagingException {
        sendHtmlMessage(mailBody);
    }

    public String getOtpEmailTemplate(String userName, String otp) {
        try {
            // Load template from resources
            ClassPathResource resource = new ClassPathResource("templates/email/otp-email.html");
            String template = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

            // Replace placeholders
            template = template.replace("[USER_NAME]", userName);
            template = template.replace("[OTP_CODE]", otp);
            template = template.replace("[WEBSITE_URL]", "https://yourwebsite.com");
            template = template.replace("[PRIVACY_URL]", "https://yourwebsite.com/privacy");
            template = template.replace("[SUPPORT_URL]", "https://yourwebsite.com/support");
            template = template.replace("support@yourcompany.com", "your-support@email.com");
            template = template.replace("Your Company Name", "Your Actual Company Name");
            template = template.replace("Your Company", "Your Actual Company Name");

            return template;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load email template", e);
        }
    }

    public String getAccountCreationEmailTemplate(String userName, String email) {
        try {
            // Load template from resources
            ClassPathResource resource = new ClassPathResource("templates/email/email-template.html");
            String template = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

            // Replace placeholders
            template = template.replace("[USER_NAME]", userName);
            template = template.replace("[USER_EMAIL]", email);
            template = template.replace("[SENDER_NAME]", "Team ProjectHub");

            return template;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load email template", e);
        }
    }

    @Override
    public String getInviteUserEmailTemplate(InvitedUsers invitedUser, String inviterName) {
        try {
            // Load template from resources
            ClassPathResource resource = new ClassPathResource("templates/email/invite-user.html");
            String template = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

            // Replace placeholders
            template = template.replace("[INVITER_NAME]", inviterName);
            template = template.replace("[INVITED_EMAIL]", invitedUser.getEmail());
            template = template.replace("[USER_ROLE]", invitedUser.getRole().getName());
            template = template.replace("[SIGNUP_LINK]", "Team ProjectHub");

            return template;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load email template", e);
        }
    }

    @Override
    public String getProjectSummaryEmailTemplate(String recipientEmail, String senderName, String senderEmail, String projectName) {
        try {
            // Load template from resources
            ClassPathResource resource = new ClassPathResource("templates/email/project-summary-email.html");
            String template = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

            // Replace placeholders
            template = template.replace("[RECIPIENT_EMAIL]", recipientEmail);
            template = template.replace("[SENDER_NAME]", senderName);
            template = template.replace("[PROJECT_NAME]", projectName);
            template = template.replace("[SHARED_DATE]", new Date().toString());
            template = template.replace("[SENDER_EMAIL]", senderEmail);

            return template;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load email template", e);
        }
    }

    @Override
    public void sendSummaryEmail(MailBody mailBody, byte[] pdfAttachment) throws MessagingException {

        MimeMessage message = javaMailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true);

        helper.setTo(mailBody.to());
        helper.setFrom(myEmailId);
        helper.setSubject(mailBody.subject());
        helper.setText(mailBody.text(), true);

        helper.addAttachment("Project-Summary.pdf",
                new ByteArrayResource(pdfAttachment));

        javaMailSender.send(message);
    }

    @Override
    public String getDeadlineEmail(String username, String projectName, String entityName, String entityType, String endDate, String delay, NotificationType type){
        try {
            // Load template from resources
            ClassPathResource resource;

            if (type.equals(NotificationType.NEARING_DEADLINE)) resource = new ClassPathResource("templates/email/deadline-email.html");
            else resource = new ClassPathResource("templates/email/overdue-email.html");

            String template = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

            // Replace placeholders
            template = template.replace("[USER_NAME]", username);
            template = template.replace("[PROJECT_NAME]", projectName);
            template = template.replace("[ENTITY_NAME]", entityName);
            template = template.replace("[ENTITY_TYPE]", entityType);
            template = template.replace("[END_DATE]", endDate);
            template = template.replace("[DELAY]", delay);

            return template;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load email template", e);
        }
    }

}


