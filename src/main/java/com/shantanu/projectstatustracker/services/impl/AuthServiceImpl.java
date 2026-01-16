package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.dtos.UpdatePasswordRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserLoginRequestDTO;
import com.shantanu.projectstatustracker.dtos.UserRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.ProjectMemberMapper;
import com.shantanu.projectstatustracker.dtos.mappers.UserMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.*;
import com.shantanu.projectstatustracker.services.*;
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
    private final EmailService emailService;
    private final PasswordEncoder encoder;
    private final ProjectService projectService;
    private final UserMapper userMapper;

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
                .status("ACTIVE")
                .role(roleRepo.findByName("MEMBER").orElseThrow())
                .build();

        userRepo.save(user);

        if (invitedMembersRepo.existsByEmail(userRequestDTO.getEmail())){
            List<InvitedMembers> assignments = invitedMembersRepo.findAllByEmail(userRequestDTO.getEmail());
            user.setStatus("ACTIVE");
            for (InvitedMembers assignment : assignments){
                //user.setRole(roleRepo.findByName(assignment.getRole()).orElseThrow(() -> new ResourceNotFoundException("Role not found")));
                //user.setRole(roleRepo.findByName("PROJECT HANDLER").orElseThrow(() -> new ResourceNotFoundException("Role not found")));

                Project project = projectRepo.findById(assignment.getProjectId())
                        .orElseThrow(()->new ResourceNotFoundException("Project with id("+assignment.getProjectId()+") not found"));

                ProjectMember projectMember = projectMemberMapper.mapRequestToProjectMember(project,user,assignment.getAssignedBy(),assignment.getRole());
                projectMemberRepo.save(projectMember);

                activityLogService.log(
                        project.getProjectId(),
                        assignment.getAssignedBy().getEmail(),
                        assignment.getAssignedBy().getName() + "added new member " + userRequestDTO.getName() + " to the project.",
                        EntityType.PROJECT_MEMBER,
                        projectMember.getMemberId()
                );

                invitedMembersRepo.delete(assignment);
            }
        }

        //Send mail to registered User
        String htmlContent = emailService.getAccountCreationEmailTemplate(user.getName(), user.getEmail());

        MailBody mailBody = MailBody.builder()
                .to(user.getEmail())
                .text(htmlContent)  // add HTML template
                .subject("")
                .build();

        emailService.sendHtmlMessageAsync(mailBody);

        //Return response
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

        String accessToken = jwtService.generateToken(user.getEmail(), user.getName(), user.getRole().getName(),accessTokenTime, user.getUserId());
        String refreshToken = jwtService.generateToken(user.getEmail(), user.getName(), user.getRole().getName(),refreshTokenTime, user.getUserId());


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

        String newAccessToken = jwtService.generateToken(email, user.getName(), user.getRole().getName(), accessTokenTime, user.getUserId()); // generate new Access Token

        return ResponseEntity.ok(Map.of("accessToken",newAccessToken));
    }

    @Override
    public ResponseEntity<Object> updatePassword(Long userId, UpdatePasswordRequestDTO request) {

        User user = userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!encoder.matches(request.getOldPassword(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Old password is incorrect"));
        }

        if (request.getOldPassword().equals(request.getNewPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "New password must be different from old password"));
        }

        user.setPassword(encoder.encode(request.getNewPassword()));
        userRepo.save(user);

        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }

    @Override
    public ResponseEntity<Object> updateUsername(Long userId, String username) {
        User user = userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setName(username);
        userRepo.save(user);

        return ResponseEntity.ok(Map.of("message","Username updated successfully"));
    }

    @Override
    public ResponseEntity<Object> removeUser(Long userId) {
        User user = userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        user.setIsUserActive(false);

        List<ProjectMember> projectMemberList = projectMemberRepo.findByUser_UserId(userId);

        for (ProjectMember projectMember : projectMemberList){
            projectService.removeProjectMember(projectMember.getProject().getProjectId(),projectMember.getMemberId());
        }

        userRepo.save(user);

        return ResponseEntity.ok(Map.of("message","User removed successfully"));
    }

    @Override
    public ResponseEntity<Object> getUserById(Long userId){
        User user = userRepo.findById(userId).orElseThrow(() -> new ResourceNotFoundException("User not found"));

        return ResponseEntity.ok(userMapper.mapUserToUserResponseDTO(user));
    }

}

