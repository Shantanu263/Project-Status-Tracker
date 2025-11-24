package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.UserLoginRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMemberMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.InvitedMembers;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.ActivityLogService;
import com.shantanu.projectstatustracker.services.AuthService;
import com.shantanu.projectstatustracker.services.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@RequiredArgsConstructor
@Service
public class AuthServiceImpl implements AuthService {
    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final InvitedMembersRepo invitedMembersRepo;
    private final ProjectMemberRepo projectMemberRepo;
    private final ProjectMemberMapper projectMemberMapper;
    private final ProjectRepo projectRepo;
    private final RoleRepo roleRepo;
    private final ActivityLogService activityLogService;

    @Value("${jwt.accessTokenTime}")
    private long accessTokenTime;

    @Value("${jwt.refreshTokenTime}")
    private long refreshTokenTime;

    @Override
    public ResponseEntity<Object> signUp(UserRequestDTO userRequestDTO) {

        if (userRepo.existsByEmail(userRequestDTO.getEmail())){
            return ResponseEntity.badRequest().body(Map.of("message","User Email Id taken"));
        }

        User user = User.builder()
                .name(userRequestDTO.getName())
                .email(userRequestDTO.getEmail())
                .password(passwordEncoder.encode(userRequestDTO.getPassword()))
                .status("PENDING")
                .build();

        userRepo.save(user);

        if (invitedMembersRepo.existsByEmail(userRequestDTO.getEmail())){
            List<InvitedMembers> assignments = invitedMembersRepo.findAllByEmail(userRequestDTO.getEmail());
            user.setStatus("ACTIVE");
            for (InvitedMembers assignment : assignments){
                //user.setRole(roleRepo.findByName(assignment.getRole()).orElseThrow(() -> new ResourceNotFoundException("Role not found")));
                user.setRole(roleRepo.findByName("PROJECT HANDLER").orElseThrow(() -> new ResourceNotFoundException("Role not found")));
                Project project = projectRepo.findById(assignment.getProjectId())
                        .orElseThrow(()->new ResourceNotFoundException("Project with id("+assignment.getProjectId()+") not found"));

                projectMemberRepo.save(projectMemberMapper.mapRequestToProjectMember(project,user,assignment.getAssignedBy(),assignment.getRole()));

                activityLogService.log(
                        project.getProjectId(),
                        assignment.getAssignedBy().getEmail(),
                        assignment.getAssignedBy().getName() + "added new member " + userRequestDTO.getName() + " to the project."
                );

                invitedMembersRepo.delete(assignment);
            }
        }

        return ResponseEntity.ok(Map.of("message","User signed up successfully"));
    }

    @Override
    public ResponseEntity<Object> login(UserLoginRequestDTO userLoginRequestDTO) {
        User user = userRepo.findByEmail(userLoginRequestDTO.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + userLoginRequestDTO.getEmail()));

        if (user.getRole() == null && !Objects.equals(user.getStatus(), "INVITED")) return new ResponseEntity<>(Map.of("message","Role not assigned to user"), HttpStatus.UNAUTHORIZED);



        if (!passwordEncoder.matches(userLoginRequestDTO.getPassword(), user.getPassword())) {
            return new ResponseEntity<>(Map.of("message","Incorrect Password"), HttpStatus.UNAUTHORIZED);
        }

        String accessToken = jwtService.generateToken(user.getEmail(), user.getName(), user.getRole().getName(),accessTokenTime);
        String refreshToken = jwtService.generateToken(user.getEmail(), user.getName(), user.getRole().getName(),refreshTokenTime);


        return ResponseEntity.ok(Map.of("message","User signed in","accessToken",accessToken,"refreshToken",refreshToken));
    }

    @Override
    public ResponseEntity<Object> refresh(Map<String, String> request) {
        String refreshToken = request.get("refreshToken");

        if (refreshToken == null || refreshToken.isEmpty()){
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Refresh token not found");
        }

        String email = jwtService.extractEmail(refreshToken);
        User user = userRepo.findByEmail(email)
                .orElseThrow(()->new ResourceNotFoundException("User email ID not found"));

        if (!jwtService.validateToken(refreshToken,user)){
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid refresh token");
        }

        String newAccessToken = jwtService.generateToken(email, user.getName(), user.getRole().getName(), accessTokenTime); // generate new Access Token

        return ResponseEntity.ok(Map.of("accessToken",newAccessToken));
    }
}
