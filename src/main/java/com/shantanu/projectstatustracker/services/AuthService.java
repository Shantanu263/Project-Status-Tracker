package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.UserLoginRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserRequestDTO;
import org.springframework.http.ResponseEntity;

import java.util.Map;

public interface AuthService {
    ResponseEntity<Object> signUp(UserRequestDTO userRequestDTO);

    ResponseEntity<Object> login(UserLoginRequestDTO userLoginRequestDTO);

    ResponseEntity<Object> refresh(Map<String, String> request);
}
