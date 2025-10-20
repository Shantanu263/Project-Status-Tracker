package com.shantanu.projectstatustracker.repositories;

import com.shantanu.projectstatustracker.models.ForgotPasswordOTP;
import com.shantanu.projectstatustracker.models.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ForgotPasswordOTPRepo extends JpaRepository<ForgotPasswordOTP, Long> {
    Optional<ForgotPasswordOTP> findByUser(User user);

    Optional<ForgotPasswordOTP> findByOtpAndUser_Email(Integer otp, String userEmail);
}
