package com.shantanu.projectstatustracker.models;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Entity
@Table(name = "delay_logs")
@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class DelayLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long projectId;
    private Long phaseId;
    private Long taskId;
    private Long assigneeId;

    private EntityType entityType;

    private Date originalEndDate;
    private Date revisedEndDate;

    private String reason;

    private String status;

}
