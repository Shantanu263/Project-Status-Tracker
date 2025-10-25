package com.shantanu.projectstatustracker.models;


import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.Column;
import jakarta.persistence.ManyToOne;

import java.time.LocalDateTime;
import java.util.Date;

public class Task {
    private Long id;

    private String taskName;

    @Column(length = 1000)
    private String description;

    @ManyToOne
    private Phase projectPhase;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date startDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "dd-MM-yyyy")
    private Date endDate;

    private String status;

    private String priority;

    private ProjectMember projectMember;
}
