package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.MailBody;
import jakarta.mail.MessagingException;

public interface EmailService {
    void sendSimpleMessage(MailBody mailBody);
    void sendHtmlMessage(MailBody mailBody) throws MessagingException;
    String getOtpEmailTemplate(String userName, String otp);

}
