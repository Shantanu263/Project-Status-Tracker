package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.ForgotPasswordOTP;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.ForgotPasswordOTPRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.EmailService;
import com.shantanu.projectstatustracker.services.ForgotPasswordService;
import com.shantanu.projectstatustracker.services.JwtService;
import jakarta.mail.MessagingException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.Random;


@RequiredArgsConstructor
@Service
public class ForgotPasswordServiceImpl implements ForgotPasswordService {
    private final UserRepo userRepo;
    private final ForgotPasswordOTPRepo forgotPasswordOTPRepo;
    private final EmailService emailService;
    private final JwtService jWTService;
    private final PasswordEncoder encoder;

    @Override
    @Transactional
    public ResponseEntity<Object> verifyEmail(String email) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User with Email Id: " + email + " not found"));

        int otp = new Random().nextInt(100_000, 999_999);

        // Generate HTML content using template
        String htmlContent = emailService.getOtpEmailTemplate(user.getName(), String.valueOf(otp));

        MailBody mailBody = MailBody.builder()
                .to(email)
                .text(htmlContent)  // add HTML template
                .subject("Password Reset OTP - Secure Your Account")
                .build();

        ForgotPasswordOTP forgotPasswordOTP = forgotPasswordOTPRepo.findByUser(user)
                .orElse(ForgotPasswordOTP.builder().user(user).build());

        forgotPasswordOTP.setOtp(otp);
        forgotPasswordOTP.setExpirationTime(new Date(System.currentTimeMillis() + 90 * 1000));

        try {
            emailService.sendHtmlMessage(mailBody);  // Use HTML email method
            forgotPasswordOTPRepo.save(forgotPasswordOTP);
            return ResponseEntity.ok(Map.of("message", "Email sent for verification"));
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send email", e);
        }
    }

    @Override
    public ResponseEntity<Object> verifyOtp(int otp, String email){
        ForgotPasswordOTP savedOtp = forgotPasswordOTPRepo.findByOtpAndUser_Email(otp,email)
                .orElseThrow(()-> new ResourceNotFoundException("Otp not present or mismatching for User Email:"+email));

        if (savedOtp.getExpirationTime().before(Date.from(Instant.now()))){
            forgotPasswordOTPRepo.delete(savedOtp);
            return ResponseEntity.status(HttpStatus.EXPECTATION_FAILED).body("OTP expired");
        }
        forgotPasswordOTPRepo.delete(savedOtp);

        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User with Email Id: " + email + " not found"));

        String resetToken = jWTService.generateToken(user.getEmail(),user.getName(), user.getRole().getName(), 1000 * 180);  //3 mins
        return ResponseEntity.ok(Map.of("resetToken", resetToken));
    }

    @Override
    public ResponseEntity<Object> changePassword(String newPassword, Long userId) {
        User user = userRepo.findById(userId)
                .orElseThrow(()-> new ResourceNotFoundException("User with User Id: " + userId + " not found"));

        if (encoder.matches(newPassword, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "New password must be different from old password"));
        }

        user.setPassword(encoder.encode(newPassword));
        userRepo.save(user);

        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }
}
