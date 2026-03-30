package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class BulkUpdateResponseDTO {
    private List<Long> successIds = new ArrayList<>();
    private List<FailedItem> failedItems = new ArrayList<>();
}
