package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.models.User;
import io.jsonwebtoken.Claims;

import java.util.Date;
import java.util.function.Function;

public interface JwtService {
    String generateToken(String email, String name, String role, long time);

    String extractEmail(String token);

    <T> T extractClaim(String token, Function<Claims, T> claimResolver);

    Claims extractAllClaims(String token);

    boolean validateToken(String token, User user);

    boolean isTokenExpired(String token);

    Date extractExpiration(String token);

    String extractRole(String jwtToken);

    String extractName(String token);
}
