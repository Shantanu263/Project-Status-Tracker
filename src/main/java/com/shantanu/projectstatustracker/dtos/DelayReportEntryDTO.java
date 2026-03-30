package com.shantanu.projectstatustracker.dtos;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DelayReportEntryDTO {

    private String itemName;
    private String entityType;
    private String originalEndDate;
    private String revisedEndDate;
    private long delayDays;
    private String assigneeName;
    private String status;
    private String statusClass;
    private String reason;
}

