package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.services.ForgotPasswordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/forgot-password")
public class ForgotPasswordController {
    private final ForgotPasswordService forgotPasswordService;

    @PostMapping("/verifyMail")
    public ResponseEntity<Object> verifyEmail(@RequestBody Map<String,String> email) {
        return forgotPasswordService.verifyEmail(email.get("email"));
    }

    @PostMapping("/verifyOtp")
    public ResponseEntity<Object> verifyOtp(@RequestBody Map<String,Object> request){
        return forgotPasswordService.verifyOtp((int) request.get("otp"),(String) request.get("email"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Object> changePassword(@RequestBody Map<String,String> request, @RequestAttribute Long userId){
        return forgotPasswordService.changePassword(request.get("newPassword"),userId);
    }

}
