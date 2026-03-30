package com.shantanu.projectstatustracker.config;

import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.ProjectTemplate;
import com.shantanu.projectstatustracker.models.ProjectTemplatePhase;
import com.shantanu.projectstatustracker.models.Role;
import com.shantanu.projectstatustracker.models.User;
import com.shantanu.projectstatustracker.repositories.ProjectTemplatePhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectTemplateRepo;
import com.shantanu.projectstatustracker.repositories.RoleRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepo userRepository;
    private final RoleRepo roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final ProjectTemplateRepo projectTemplateRepository;
    private final ProjectTemplatePhaseRepo projectTemplatePhaseRepository;

    @Override
    public void run(String... args) {

        // ----- ROLES -----
        createRoleIfNotFound("SUPER ADMIN");
        createRoleIfNotFound("ADMIN");
        createRoleIfNotFound("MEMBER");

        // ----- SUPER ADMIN -----
        if (!userRepository.existsByRole_Name("SUPER ADMIN")) {
            Role superAdminRole = roleRepository.findByName("SUPER ADMIN")
                    .orElseThrow(() -> new ResourceNotFoundException("SUPER ADMIN role not found"));

            User superAdmin = new User();
            superAdmin.setName("Super Admin");
            superAdmin.setEmail("superadmin@cybernxt.com");
            superAdmin.setPassword(passwordEncoder.encode("Admin@123"));
            superAdmin.setRole(superAdminRole);
            //superAdmin.setStatus("ACTIVE");

            userRepository.save(superAdmin);
        }

        // ----- PROJECT TEMPLATES -----
        seedProjectTemplates();
    }

    // ---------------- HELPER METHODS ----------------

    private void createRoleIfNotFound(String roleName) {
        if (!roleRepository.existsByName(roleName)) {
            Role role = new Role();
            role.setName(roleName);
            roleRepository.save(role);
        }
    }

    private void seedProjectTemplates() {

        createTemplateWithPhases(
                "Software Development Lifecycle",
                "Typical SDLC Phases",
                List.of(
                        "Requirements Analysis",
                        "Design",
                        "Implementation",
                        "Testing",
                        "Deployment"
                )
        );

        createTemplateWithPhases(
                "Research Project",
                "Phases for research workflow.",
                List.of(
                        "Literature Review",
                        "Experimentation",
                        "Analysis"
                )
        );

        createTemplateWithPhases(
                "Construction Project",
                "Phases for construction cycle.",
                List.of(
                        "Planning",
                        "Construction",
                        "Inspection"
                )
        );
    }

    private void createTemplateWithPhases(
            String templateName,
            String description,
            List<String> phases
    ) {

        if (projectTemplateRepository.existsByTemplateName(templateName)) {
            return;
        }

        ProjectTemplate template = new ProjectTemplate();
        template.setTemplateName(templateName);
        template.setDescription(description);

        ProjectTemplate savedTemplate = projectTemplateRepository.save(template);

        //int orderIndex = 1;
        for (String phaseName : phases) {
            ProjectTemplatePhase phase = new ProjectTemplatePhase();
            phase.setPhaseName(phaseName);
            //phase.setOrderIndex(orderIndex++);
            phase.setProjectTemplate(savedTemplate);

            projectTemplatePhaseRepository.save(phase);
        }
    }
}


