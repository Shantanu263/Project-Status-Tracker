package com.shantanu.projectstatustracker.services.impl;

import com.shantanu.projectstatustracker.dtos.InviteUserDTO;
import com.shantanu.projectstatustracker.dtos.MailBody;
import com.shantanu.projectstatustracker.dtos.RoleRequestDTO;
import com.shantanu.projectstatustracker.dtos.mappers.UserMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.InvitedUsers;
import com.shantanu.projectstatustracker.models.Role;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.InvitedUsersRepo;
import com.shantanu.projectstatustracker.repositories.RoleRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.AdminService;
import com.shantanu.projectstatustracker.services.EmailService;
import jakarta.mail.MessagingException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;


@RequiredArgsConstructor
@Service
public class AdminServiceImpl implements AdminService {
    private final UserRepo userRepo;
    private final RoleRepo roleRepo;
    private final UserMapper userMapper;
    private final InvitedUsersRepo invitedUsersRepo;
    private final EmailService emailService;
    private final HttpServletRequest servletRequest;
    private static final Logger log = LoggerFactory.getLogger(AdminServiceImpl.class);

    @Override
    public ResponseEntity<Object> getUsers(int pageNumber, int pageSize, String sortBy, String order, String search) {

        Sort sort = order.equalsIgnoreCase("desc") ?
                Sort.by(sortBy).descending() :
                Sort.by(sortBy).ascending();

        Pageable pageable = PageRequest.of(pageNumber, pageSize, sort);

        String searchValue = (search == null || search.isBlank()) ? "" : search;

        Page<User> result = userRepo.searchUsers(searchValue, pageable);

        return ResponseEntity.ok(toPaginatedResponse(result));

    }

//    @Override
//    public ResponseEntity<Object> getPendingUsers() {
//        return ResponseEntity.ok(userMapper.mapUsers(userRepo.findByStatus("PENDING")));
//    }

    @Override
    public ResponseEntity<Object> approveUser(Long id, RoleRequestDTO req) {
        User user = userRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));

        Role role = roleRepo.findByName(req.getRoleName())
                .orElseThrow(() -> new ResourceNotFoundException("Role not found with name: " + req.getRoleName()));

        user.setRole(role);
        userRepo.save(user);

        return ResponseEntity.ok(Map.of("message","Assigned role to user: " + req.getRoleName()));
    }

    @Override
    public ResponseEntity<Object> inviteUser(InviteUserDTO inviteUserDTO) {
        if (userRepo.existsByEmail(inviteUserDTO.getEmail())) {
            return new ResponseEntity<>(Map.of("message", "User account with this email already exists!"),
                    HttpStatus.BAD_REQUEST);
        }

        InvitedUsers invitedUser = InvitedUsers.builder()
                .email(inviteUserDTO.getEmail())
                .role(roleRepo.findByName(inviteUserDTO.getRoleName()).orElseThrow(() -> new ResourceNotFoundException("Role not found")))
                .build();

        User user = userRepo.findByEmail(servletRequest.getAttribute("email").toString())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String htmlContent = emailService.getInviteUserEmailTemplate(invitedUser, user.getName());

        MailBody mailBody = MailBody.builder()
                .to(invitedUser.getEmail())
                .text(htmlContent)  // add HTML template
                .subject("You are invited | ProjectHub")
                .build();

        try {
            emailService.sendNotificationHtmlMessage(mailBody,true);
        } catch (MessagingException e){
            log.error("Failed to send email", e);
        }

        invitedUsersRepo.save(invitedUser);

        return ResponseEntity.ok(Map.of("message","Invitation sent to new user"));

    }

    public Map<String, Object> toPaginatedResponse(Page<User> page) {
        Map<String, Object> response = new HashMap<>();
        response.put("content", page.getContent().stream()
                .map(userMapper::mapUserToUserResponseDTO)
                .toList());
        response.put("page", page.getNumber());
        response.put("totalElements", page.getTotalElements());
        response.put("totalPages", page.getTotalPages());
        response.put("size", page.getSize());
        response.put("isLast", page.isLast());
        return response;

    }

}
