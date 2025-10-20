package com.shantanu.projectstatustracker.config;

import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.Role;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.RoleRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@RequiredArgsConstructor
@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepo userRepository;
    private final RoleRepo roleRepository;
    private final PasswordEncoder passwordEncoder;


    @Override
    public void run(String... args) {

        // Ensure roles exist
        createRoleIfNotFound("SUPER ADMIN");
        createRoleIfNotFound("PROJECT HEAD");
        createRoleIfNotFound("PROJECT HANDLER");
        createRoleIfNotFound("VIEWER");

        // Ensure a Super Admin user exists
        if (!userRepository.existsByRole_Name("SUPER ADMIN")) {
            Role superAdminRole = roleRepository.findByName("SUPER ADMIN")
                    .orElseThrow(() -> new ResourceNotFoundException("SUPER ADMIN role not found!"));

            User superAdmin = new User();
            superAdmin.setName("Super Admin");
            superAdmin.setEmail("superadmin@cybernxt.com");
            superAdmin.setPassword(passwordEncoder.encode("Admin@123"));
            superAdmin.setRole(superAdminRole);
            superAdmin.setStatus("ACTIVE");

            userRepository.save(superAdmin);

            System.out.println("Super Admin user created with email: superadmin@cybernxt.com");
        } else {
            System.out.println("Super Admin already exists, skipping creation.");
        }
    }

    private void createRoleIfNotFound(String roleName) {
        if (!roleRepository.existsByName(roleName)) {
            Role role = new Role();
            role.setName(roleName);
            roleRepository.save(role);
            System.out.println("Role created: " + roleName);
        }
    }

}

