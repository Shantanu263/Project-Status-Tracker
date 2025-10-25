package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.services.EmailService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;


@RequiredArgsConstructor
@Service
public class EmailServiceImpl implements EmailService {
    private final JavaMailSender javaMailSender;

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

}


