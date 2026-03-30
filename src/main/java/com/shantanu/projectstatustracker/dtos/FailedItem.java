package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

@Data
public class FailedItem {
    private Long id;
    private String reason;

    public FailedItem(Long id, String reason) {
        this.id = id;
        this.reason = reason;
    }
}
