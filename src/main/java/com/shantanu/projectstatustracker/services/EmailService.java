package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.MailBody;

public interface EmailService {
    void sendSimpleMessage(MailBody mailBody);
}
