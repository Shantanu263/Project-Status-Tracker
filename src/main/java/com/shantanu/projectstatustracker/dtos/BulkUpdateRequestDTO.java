package com.shantanu.projectstatustracker.dtos;

import lombok.Data;

import java.util.List;

@Data
public class BulkUpdateRequestDTO<U> {
    private List<Long> ids;
    private U updates;

}
