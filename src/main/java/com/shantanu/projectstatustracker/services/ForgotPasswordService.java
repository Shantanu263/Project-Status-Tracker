package com.shantanu.projectstatustracker.services;

import org.springframework.http.ResponseEntity;

public interface ForgotPasswordService {
    ResponseEntity<Object> verifyEmail(String email);
    ResponseEntity<Object> verifyOtp(int otp, String email);
    ResponseEntity<Object> changePassword(String newPassword, Long userId);
}
