package com.shantanu.projectstatustracker.dtos;

import com.shantanu.projectstatustracker.models.PhaseStatus;
import jakarta.annotation.Nullable;
import lombok.Data;

import java.util.Date;

@Data
public class PhaseRequestDTO {

    String phaseName;

    String description;

    Date startDate;

    Date endDate;

    PhaseStatus status;

    @Nullable
    Long projectMemberId;

}
