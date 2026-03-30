package com.shantanu.projectstatustracker.services.impl;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.shantanu.projectstatustracker.dtos.*;
import com.shantanu.projectstatustracker.dtos.mappers.DelayLogMapper;
import com.shantanu.projectstatustracker.globalExceptionHandlers.ResourceNotFoundException;
import com.shantanu.projectstatustracker.models.DelayLog;
import com.shantanu.projectstatustracker.models.EntityType;
import com.shantanu.projectstatustracker.models.Phase;
import com.shantanu.projectstatustracker.models.Project;
import com.shantanu.projectstatustracker.models.Task;
import com.shantanu.projectstatustracker.repositories.DelayLogRepo;
import com.shantanu.projectstatustracker.repositories.PhaseRepo;
import com.shantanu.projectstatustracker.repositories.ProjectRepo;
import com.shantanu.projectstatustracker.repositories.TaskRepo;
import com.shantanu.projectstatustracker.services.DelayTrackerService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Entities;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;

@RequiredArgsConstructor
@Service
public class DelayTrackerServiceImpl implements DelayTrackerService {

    private final ProjectRepo projectRepo;
    private final DelayLogRepo delayLogRepo;
    private final DelayLogMapper delayLogMapper;
    private final PhaseRepo phaseRepo;
    private final TaskRepo taskRepo;
    private final TemplateEngine templateEngine;

    private final PlatformTransactionManager transactionManager;
    private final TransactionTemplate transactionTemplate;

    @PostConstruct
    public void init() {
        TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager);
        transactionTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("dd MMM yyyy", Locale.ENGLISH);

    @Override
    public ResponseEntity<Object> getDelayLogsForProject(Long projectId) {
        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));

        return ResponseEntity.ok(delayLogMapper.mapDelayLogsToResponseDTOs(delayLogRepo.findAllByProjectId(projectId)));
    }

    @Override
    public ResponseEntity<Object> createDelayLog(Long projectId, DelayLogRequestDTO delayLogRequestDTO) {
        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));

        if (delayLogRequestDTO.getEntityType() == EntityType.PHASE) {
            if (delayLogRepo.existsByProjectIdAndEntityTypeAndPhaseId(projectId, EntityType.PHASE, delayLogRequestDTO.getPhaseId())) {
                return new ResponseEntity<>(Map.of("message", "A delay log for this phase already exists"), HttpStatus.BAD_REQUEST);
            }
        } else if (delayLogRequestDTO.getEntityType() == EntityType.TASK) {
            if (delayLogRepo.existsByProjectIdAndEntityTypeAndPhaseIdAndTaskId(projectId,EntityType.TASK, delayLogRequestDTO.getPhaseId(), delayLogRequestDTO.getTaskId())) {
                return new ResponseEntity<>(Map.of("message", "A delay log for this task already exists"), HttpStatus.BAD_REQUEST);
            }
        }

        if (delayLogRequestDTO.getOriginalEndDate().after(delayLogRequestDTO.getRevisedEndDate())) {
            return new ResponseEntity<>(Map.of("message", "Revised end date cannot be before original end date for Delay Log"), HttpStatus.BAD_REQUEST);
        }

        DelayLog delayLog = delayLogMapper.mapDelayLogRequestDTOToDelayLog(delayLogRequestDTO);
        delayLogRepo.save(delayLog);

        return ResponseEntity.ok(Map.of("message","Delay log created successfully"));
    }

    @Override
    public ResponseEntity<Object> updateDelayLog(Long projectId, Long delayLogId, DelayLogRequestDTO delayLogRequestDTO) {
        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));
        DelayLog existingDelayLog = delayLogRepo.findById(delayLogId).orElseThrow(() -> new ResourceNotFoundException("Delay log not found with id: " + delayLogId));

        Date newOriginalEndDate = delayLogRequestDTO.getOriginalEndDate() != null ? delayLogRequestDTO.getOriginalEndDate() : existingDelayLog.getOriginalEndDate();
        Date newRevisedEndDate = delayLogRequestDTO.getRevisedEndDate() != null ? delayLogRequestDTO.getRevisedEndDate() : existingDelayLog.getRevisedEndDate();

        if (newRevisedEndDate.before(newOriginalEndDate)) return new ResponseEntity<>(Map.of("message", "Revised end date cannot be before original end date for Delay Log"), HttpStatus.BAD_REQUEST);

        delayLogMapper.updateDelayLogFromDTO(delayLogRequestDTO, existingDelayLog);
        delayLogRepo.save(existingDelayLog);

        return ResponseEntity.ok(Map.of("message","Delay log updated successfully"));
    }

    @Override
    public ResponseEntity<Object> deleteDelayLog(Long projectId, Long delayLogId) {
        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));
        DelayLog existingDelayLog = delayLogRepo.findById(delayLogId).orElseThrow(() -> new ResourceNotFoundException("Delay log not found with id: " + delayLogId));

        delayLogRepo.delete(existingDelayLog);
        return ResponseEntity.ok(Map.of("message","Delay log deleted successfully"));
    }

    @Override
    public byte[] generateDelayReport(Long projectId, List<Long> delayIds) {

        Project project = projectRepo.findById(projectId)
                .orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));

        // Fetch delay logs — either the requested subset or all if none specified
        List<DelayLog> logs;
        if (delayIds != null && !delayIds.isEmpty()) {
            logs = delayLogRepo.findAllById(delayIds).stream()
                    .filter(d -> d.getProjectId().equals(projectId))
                    .toList();
        } else {
            logs = delayLogRepo.findAllByProjectId(projectId);
        }

        // Build entry DTOs
        List<DelayReportEntryDTO> entries = new ArrayList<>();
        for (DelayLog log : logs) {
            String itemName = resolveItemName(log);
            long delayDays = computeDelayDays(log.getOriginalEndDate(), log.getRevisedEndDate());
            String statusClass = resolveStatusClass(log.getStatus());

            entries.add(DelayReportEntryDTO.builder()
                    .itemName(itemName)
                    .entityType(formatEntityType(log.getEntityType()))
                    .originalEndDate(log.getOriginalEndDate() != null ? DATE_FORMAT.format(log.getOriginalEndDate()) : "-")
                    .revisedEndDate(log.getRevisedEndDate() != null ? DATE_FORMAT.format(log.getRevisedEndDate()) : "-")
                    .delayDays(delayDays)
                    .assigneeName(resolveAssigneeName(log))
                    .status(log.getStatus() != null ? log.getStatus() : "-")
                    .statusClass(statusClass)
                    .reason(log.getReason() != null ? log.getReason() : "-")
                    .build());
        }

        // Compute summary statistics
        long totalDelayDays = entries.stream().mapToLong(DelayReportEntryDTO::getDelayDays).sum();
        long resolvedCount = entries.stream()
                .filter(e -> "RESOLVED".equalsIgnoreCase(e.getStatus()))
                .count();
        long activeCount = entries.size() - resolvedCount;

        // Longest delay label
        String longestDelayLabel = entries.stream()
                .max(Comparator.comparingLong(DelayReportEntryDTO::getDelayDays))
                .map(e -> e.getItemName() + " — " + e.getDelayDays() + " days")
                .orElse("-");

        // Most affected phase: phase entry with the highest delay days
        String mostAffectedPhase = entries.stream()
                .filter(e -> "Phase".equalsIgnoreCase(e.getEntityType()))
                .max(Comparator.comparingLong(DelayReportEntryDTO::getDelayDays))
                .map(DelayReportEntryDTO::getItemName)
                .orElseGet(() -> entries.isEmpty() ? "-" : entries.getFirst().getItemName());

        // Build Thymeleaf context
        Context context = new Context();
        context.setVariable("PROJECT_NAME", project.getProjectName());
        context.setVariable("REPORT_DATE", DATE_FORMAT.format(new Date()));
        context.setVariable("TOTAL_DELAY_ENTRIES", entries.size());
        context.setVariable("TOTAL_DELAY_DAYS", totalDelayDays);
        context.setVariable("RESOLVED_COUNT", resolvedCount);
        context.setVariable("ACTIVE_COUNT", activeCount);
        context.setVariable("DELAY_ENTRIES", entries);
        context.setVariable("LONGEST_DELAY_LABEL", longestDelayLabel);
        context.setVariable("MOST_AFFECTED_PHASE", mostAffectedPhase);

        String html = templateEngine.process("delay-report", context);
        return generatePdf(html);
    }

    @Override
    public ResponseEntity<Object> bulkAddDelayLogs(Long projectId, List<DelayLogRequestDTO> delayLogRequestDTOS) {
        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));

        List<String> failedDelayLogs = new ArrayList<>();

        List<DelayLogRequestDTO> validRequests = new ArrayList<>();

        for (DelayLogRequestDTO dto : delayLogRequestDTOS) {

            boolean isValid = true;

            if (dto.getEntityType() == EntityType.PHASE) {

                if (delayLogRepo.existsByProjectIdAndEntityTypeAndPhaseId(
                        projectId, EntityType.PHASE, dto.getPhaseId())) {

                    failedDelayLogs.add("A delay log for phase ID " + dto.getPhaseId() + " already exists");
                    isValid = false;
                }

                if (dto.getOriginalEndDate().after(dto.getRevisedEndDate())) {
                    failedDelayLogs.add("Revised end date cannot be before original end date for PHASE with id " + dto.getPhaseId());
                    isValid = false;
                }

            } else if (dto.getEntityType() == EntityType.TASK) {

                if (delayLogRepo.existsByProjectIdAndEntityTypeAndPhaseIdAndTaskId(
                        projectId, EntityType.TASK, dto.getPhaseId(), dto.getTaskId())) {

                    failedDelayLogs.add("A delay log for task ID " + dto.getTaskId() + " already exists");
                    isValid = false;
                }

                if (dto.getOriginalEndDate().after(dto.getRevisedEndDate())) {
                    failedDelayLogs.add("Revised end date cannot be before original end date for TASK with id " + dto.getTaskId());
                    isValid = false;
                }
            }

            if (isValid) {
                validRequests.add(dto);
            }
        }

        List<DelayLog> delayLogs = delayLogMapper.mapDelayLogRequestDTOSToDelayLogs(validRequests);
        delayLogRepo.saveAll(delayLogs);

        return ResponseEntity.ok(Map.of("message","Delay logs created successfully","failedEntries", failedDelayLogs));
    }

    @Override
    public ResponseEntity<Object> bulkUpdateDelayLogs(Long projectId, BulkUpdateRequestDTO<DelayLogRequestDTO> bulkUpdateRequestDTO) {
        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));

        BulkUpdateResponseDTO result = new BulkUpdateResponseDTO();

        for (Long logId : bulkUpdateRequestDTO.getIds()) {
            try {
                DelayLog delayLog = delayLogRepo.findById(logId).orElseThrow(()  -> new Exception("Delay Log not found"));
                Date newOriginalEndDate = bulkUpdateRequestDTO.getUpdates().getOriginalEndDate() != null ? bulkUpdateRequestDTO.getUpdates().getOriginalEndDate() : delayLog.getOriginalEndDate();
                Date newRevisedEndDate = bulkUpdateRequestDTO.getUpdates().getRevisedEndDate() != null ? bulkUpdateRequestDTO.getUpdates().getRevisedEndDate() : delayLog.getRevisedEndDate();

                if (newRevisedEndDate.before(newOriginalEndDate)) throw new Exception("Revised end date cannot be before original end date for Delay Log");

                transactionTemplate.executeWithoutResult(status -> {
                    try {
                        delayLogMapper.updateDelayLogFromDTO(bulkUpdateRequestDTO.getUpdates(), delayLog);
                        delayLogRepo.save(delayLog);
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                });
                result.getSuccessIds().add(logId);

            } catch (Exception e) {
                result.getFailedItems().add(
                        new FailedItem(logId, e.getMessage())
                );
            }
        }

        return ResponseEntity.ok(result);
    }

    @Override
    public ResponseEntity<Object> bulkDeleteDelayLogs(Long projectId, List<Long> ids) {
        projectRepo.findById(projectId).orElseThrow(() -> new ResourceNotFoundException("Project not found with id: " + projectId));

        delayLogRepo.deleteAllById(ids);
        return ResponseEntity.ok(Map.of("message","Delay logs deleted successfully"));
    }

    // helpers

    private String resolveItemName(DelayLog log) {
        if (log.getEntityType() == EntityType.PHASE && log.getPhaseId() != null) {
            Optional<Phase> phase = phaseRepo.findById(log.getPhaseId());
            return phase.map(Phase::getPhaseName).orElse("Phase #" + log.getPhaseId());
        }
        if (log.getEntityType() == EntityType.TASK && log.getTaskId() != null) {
            Optional<Task> task = taskRepo.findById(log.getTaskId());
            return task.map(Task::getTaskName).orElse("Task #" + log.getTaskId());
        }
        return log.getEntityType() != null ? log.getEntityType().name() : "Unknown";
    }

    private String resolveAssigneeName(DelayLog log) {
        if (log.getAssigneeId() == null) return "Unassigned";
        // Try to resolve through phase or task assignment
        if (log.getEntityType() == EntityType.PHASE && log.getPhaseId() != null) {
            return phaseRepo.findById(log.getPhaseId())
                    .map(p -> p.getAssignedTo() != null ? p.getAssignedTo().getUser().getName() : "Unassigned")
                    .orElse("Unassigned");
        }
        if (log.getEntityType() == EntityType.TASK && log.getTaskId() != null) {
            return taskRepo.findById(log.getTaskId())
                    .map(t -> t.getAssignedTo() != null ? t.getAssignedTo().getUser().getName() : "Unassigned")
                    .orElse("Unassigned");
        }
        return "Unassigned";
    }

    private long computeDelayDays(Date original, Date revised) {
        if (original == null || revised == null) return 0;
        long diff = revised.getTime() - original.getTime();
        return Math.max(0, diff / (1000 * 60 * 60 * 24));
    }

    private String formatEntityType(EntityType type) {
        if (type == null) return "-";
        return switch (type) {
            case PHASE -> "Phase";
            case TASK -> "Task";
            case SUBTASK -> "Subtask";
            default -> type.name();
        };
    }

    private String resolveStatusClass(String status) {
        if (status == null) return "status-open";
        return switch (status.toUpperCase()) {
            case "RESOLVED" -> "status-resolved";
            default -> "status-open";
        };
    }

    private byte[] generatePdf(String html) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
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
            throw new RuntimeException("Failed to generate delay report PDF", e);
        }
    }
}
