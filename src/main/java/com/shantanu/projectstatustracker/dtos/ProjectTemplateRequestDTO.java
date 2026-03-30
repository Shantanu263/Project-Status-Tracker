package com.shantanu.projectstatustracker.dtos;

import lombok.Data;
import org.w3c.dom.stylesheets.LinkStyle;

import java.util.List;

@Data
public class ProjectTemplateRequestDTO {
    private String templateName;

    private String description;

    private List<String> phaseNames;
}
