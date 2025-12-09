package com.shantanu.projectstatustracker.dtos;

import jakarta.annotation.Nullable;
import lombok.Data;

import java.util.Date;

@Data
public class PhaseRequestDTO {

    String phaseName;

    String description;

    Date startDate;

    Date endDate;

    String status;

    @Nullable
    Long projectMemberId;

}
