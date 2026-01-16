package com.shantanu.projectstatustracker.controllers;

import com.shantanu.projectstatustracker.dtos.UpdatePasswordRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserLoginRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserRequestDTO;
import com.shantanu.projectstatustracker.services.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RequiredArgsConstructor
@RestController
@CrossOrigin(origins = "http://localhost:4200")
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
    public  ResponseEntity<Object> refresh(@RequestBody Map<String,String> refreshToken){
        return authService.refresh(refreshToken);
    }

    @PatchMapping("/user/{userId}/update-username")
    public ResponseEntity<Object> updateUsername(@PathVariable(name = "userId") Long userId,
                                                 @RequestParam(name = "username") String username){
        return authService.updateUsername(userId, username);
    }

    @PatchMapping("/user/{userId}/update-password")
    public ResponseEntity<Object> updatePassword(@PathVariable(name = "userId") Long userId,
                                                 @RequestBody UpdatePasswordRequestDTO updatePasswordRequestDTO){
        return authService.updatePassword(userId, updatePasswordRequestDTO);
    }

    @DeleteMapping("/user/{userId}")
    public ResponseEntity<Object> removeUser(@PathVariable(name = "userId") Long userId){
        return authService.removeUser(userId);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<Object> getUserById(@PathVariable(name = "userId") Long userId){
        return authService.getUserById(userId);
    }

}
