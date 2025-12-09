package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.services.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.function.Function;

@Service
public class JwtServiceImpl implements JwtService {
    @Value("${jwt.secret}")
    private String SECRET;

    private SecretKey getKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes());
    }

    @Override
    public String generateToken(String email, String name, String role, long time) {
        return Jwts
                .builder()
                .subject(email)
                .claim("role",role)
                .claim("name", name)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + time))
                .signWith(getKey())
                .compact();
    }

    @Override
    public String extractEmail(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    @Override
    public String extractName(String token) { return extractAllClaims(token).get("name",String.class); }

    @Override
    public String extractRole(String token) {
        return extractAllClaims(token).get("role",String.class);
    }

    @Override
    public <T> T extractClaim(String token, Function<Claims, T> claimResolver) {
        final Claims claims = extractAllClaims(token);
        return claimResolver.apply(claims);
    }

    @Override
    public Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    @Override
    public boolean validateToken(String token, User user) {
        final String email = extractEmail(token);
        return (email.equals(user.getEmail()) && !isTokenExpired(token));
    }

    @Override
    public boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    @Override
    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }
}
