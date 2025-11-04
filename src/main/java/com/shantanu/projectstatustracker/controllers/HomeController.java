package com.shantanu.projectstatustracker.controllers;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/home")
public class HomeController {
    @GetMapping()
    public ResponseEntity<Object> home(){
        return ResponseEntity.ok("Hello");
    }

    @GetMapping("/check")
    public ResponseEntity<?> checkAuth(Authentication authentication, HttpServletRequest request) {
        return ResponseEntity.ok(Map.of(
                "principal", authentication != null ? authentication.getPrincipal() : "null",
                "emailAttr", request.getAttribute("email")
        ));
    }

    @PreAuthorize("true")
    @GetMapping("/test-preauth")
    public ResponseEntity<String> testPreAuth() {
        System.out.println("✅ PreAuthorize triggered");
        return ResponseEntity.ok("PreAuthorize works!");
    }

    @PreAuthorize("@auth.debugSpEL()")
    @GetMapping("/debug-spel")
    public ResponseEntity<String> testSpEL() {
        return ResponseEntity.ok("✅ SpEL executed");
    }


}
