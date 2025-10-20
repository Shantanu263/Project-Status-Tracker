package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.UserLoginRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserRequestDTO;
import com.shantanu.projectstatustracker.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/auth")

public class AuthController {
    private final AuthService authService;

    @PostMapping("/signup")
    public ResponseEntity<Object> signUp(@RequestBody UserRequestDTO userRequestDTO){
           return authService.signUp(userRequestDTO);
    }

    @PostMapping("/login")
    public ResponseEntity<Object> login(@RequestBody UserLoginRequestDTO userLoginRequestDTO){
        return authService.login(userLoginRequestDTO);
    }

    @PostMapping("/refresh-token")
    public  ResponseEntity<?> refresh(@RequestBody Map<String,String> refreshToken){
        return authService.refresh(refreshToken);
    }

}
