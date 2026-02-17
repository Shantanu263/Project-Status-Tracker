package com.shantanu.projectstatustracker.services.impl;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.shantanu.projectstatustracker.dtos.*;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.*;
import com.shantanu.projectstatustracker.repositories.ProjectRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.repositories.UserRepo;
import com.shantanu.projectstatustracker.services.EmailService;
import com.shantanu.projectstatustracker.services.ProjectSummaryService;
import jakarta.mail.MessagingException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Entities;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;


import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.text.DecimalFormat;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ProjectSummaryServiceImpl implements ProjectSummaryService {

    private final TemplateEngine templateEngine;
    private final ProjectRepo projectRepo;
    private final EmailService emailService;
    private final UserRepo userRepo;
    private final HttpServletRequest request;
    private final TaskRepo taskRepo;
    private static final Logger log = LoggerFactory.getLogger(ProjectSummaryServiceImpl.class);


    DecimalFormat df = new DecimalFormat("#.##");


    private String getFormattedDate(Date date){
        return date.toInstant()
                .atZone(ZoneId.systemDefault())
                .toLocalDate()
                .format(DateTimeFormatter.ofPattern("dd-MM-yyyy"));
    }

    public String generateHtmlTemplate(Long projectId, ProjectSummaryRequestDTO dto)  {
        Context context = new Context();

        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project Not Found"));

        String base64 = "";
        try {
            byte[] bytes = Files.readAllBytes(Paths.get("src/main/resources/static/cybernxt_logo.jpg"));
            base64 = Base64.getEncoder().encodeToString(bytes);
        }catch (IOException e){
            log.error("Error while reading logo file: ", e);
        }

        context.setVariable("COMPANY_LOGO_BASE64", "data:image/jpeg;base64," + base64);
        context.setVariable("PROJECT_NAME", project.getProjectName());
        context.setVariable("PROJECT_STATUS", project.getStatus());
        context.setVariable("PROJECT_STATUS_CLASS", project.getStatus());
        context.setVariable("REPORT_DATE", new Date());

        context.setVariable("PROJECT_DESCRIPTION", project.getDescription());
        context.setVariable("PROJECT_START_DATE", getFormattedDate(project.getStartDate()));
        context.setVariable("PROJECT_END_DATE", getFormattedDate(project.getEndDate()));
        context.setVariable("CURRENT_PHASE", project.getPriority());
        context.setVariable("PROJECT_PRIORITY_CLASS", project.getPriority());
        context.setVariable("OVERALL_PROGRESS", df.format(project.getProgress()));
        context.setVariable("OVERALL_PROGRESS_ROUNDED", project.getProgress().intValue());

        context.setVariable("CURRENT_STATUS", dto.getCurrentStatusHtml());

        context.setVariable("INCLUDE_COMPLETED_TASKS", dto.getRecentlyCompletedTasks());
        context.setVariable("COMPLETED_TASK_ROWS", buildTasksRows(projectId,"COMPLETED"));

        context.setVariable("INCLUDE_UPCOMING_TASKS", dto.getUpcomingTasks());
        context.setVariable("UPCOMING_TASK_ROWS", buildTasksRows(projectId,"UPCOMING"));

        context.setVariable("TEAM_MEMBERS", buildTeamMembersHtml(project.getProjectMembers()));
        context.setVariable("NEXT_STEPS", dto.getNextStepsHtml());

        context.setVariable("COMPANY_NAME", "© CyberNXT Solutions LLP.");

        return templateEngine.process("project-summary", context);

    }

    public String buildTasksRows(Long projectId, String type) {
        StringBuilder html = new StringBuilder();
        List<Task> recentTasks;
        if (type.equals("UPCOMING")) recentTasks = taskRepo.findNearestEndDateOngoingTasks(projectId, PageRequest.of(0,3));
        else recentTasks = taskRepo.findRecentlyCompletedTasks(projectId, PageRequest.of(0,3));

        for (Task task : recentTasks) {
                html.append("""
                <tr class="task-row">
                    <td>%s</td>
                    <td>%s</td>
                    <td>%s</td>
                    <td>%s</td>
                    <td><span class="taskStatus-badge taskStatus-%s">%s</span></td>
                    <td>%s</td>
                </tr>
            """.formatted(
                        task.getTaskName(),
                        task.getProjectPhase().getPhaseName(),
                        getFormattedDate(task.getStartDate()),
                        getFormattedDate(task.getEndDate()),
                        task.getStatus().toString().toLowerCase(),
                        task.getStatus().toString().toLowerCase().replace("_"," "),
                        task.getAssignedTo()!=null ? task.getAssignedTo().getUser().getName() : "unassigned"
                        ));
        }
        return html.toString();
    }

    public String buildTeamMembersHtml(List<ProjectMember> members) {

        StringBuilder html = new StringBuilder();

        for (ProjectMember member : members) {
            html.append("""
            <div class="team-member">
                <div class="team-member-name">%s</div>
                <div class="team-member-email">%s</div>
            </div>
        """.formatted(
                    escape(member.getUser().getName()),
                    escape(member.getUser().getEmail())
            ));
        }

        return html.toString();
    }

    private String escape(String value) {
        return HtmlUtils.htmlEscape(value);
    }

    public byte[] generatePdf(String html) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            // Normalize HTML → valid XHTML
            String xhtml = Jsoup.parse(html)
                    .outputSettings(
                            new Document.OutputSettings()
                                    .syntax(Document.OutputSettings.Syntax.xml)
                                    .escapeMode(Entities.EscapeMode.xhtml)
                                    .charset(StandardCharsets.UTF_8)
                    )
                    .html();

            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withHtmlContent(xhtml, null);
            builder.toStream(outputStream);
            builder.useFastMode();
            builder.run();

            return outputStream.toByteArray();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }


    public ResponseEntity<Object> generateMail(String emailId, Long projectId, byte[] pdf) {
        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        User user = userRepo.findByEmail(request.getAttribute("email").toString())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        String htmlContent = emailService.getProjectSummaryEmailTemplate(emailId,user.getName(),user.getEmail(), project.getProjectName());

        MailBody mailBody = MailBody.builder()
                .to(emailId)
                .text(htmlContent)  // add HTML template
                .subject("Project Summary Report | "+project.getProjectName()+" | ProjectHub")
                .build();
        try {
            emailService.sendSummaryEmail(mailBody,pdf);
            return ResponseEntity.ok(Map.of("message", "Email sent"));
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send email", e);
        }
    }
}
