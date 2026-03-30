package com.shantanu.projectstatustracker.services;

import com.shantanu.projectstatustracker.dtos.BulkUpdateRequestDTO;
import com.shantanu.projectstatustracker.dtos.DelayLogRequestDTO;
import org.springframework.http.ResponseEntity;

import java.util.List;

public interface DelayTrackerService {

    ResponseEntity<Object> getDelayLogsForProject(Long projectId);

    ResponseEntity<Object> createDelayLog(Long projectId, DelayLogRequestDTO delayLogRequestDTO);

    ResponseEntity<Object> updateDelayLog(Long projectId, Long delayLogId, DelayLogRequestDTO delayLogRequestDTO);

    ResponseEntity<Object> deleteDelayLog(Long projectId, Long delayLogId);

    byte[] generateDelayReport(Long projectId, List<Long> delayIds);

    ResponseEntity<Object> bulkAddDelayLogs(Long projectId, List<DelayLogRequestDTO> delayLogRequestDTOS);

    ResponseEntity<Object> bulkUpdateDelayLogs(Long projectId, BulkUpdateRequestDTO<DelayLogRequestDTO> bulkUpdateRequestDTO);

    ResponseEntity<Object> bulkDeleteDelayLogs(Long projectId, List<Long> ids);
}
