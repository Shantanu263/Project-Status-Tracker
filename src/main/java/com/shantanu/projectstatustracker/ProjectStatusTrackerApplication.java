package com.shantanu.projectstatustracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@EnableAsync
@SpringBootApplication
public class ProjectStatusTrackerApplication {

    public static void main(String[] args) {
        SpringApplication.run(ProjectStatusTrackerApplication.class, args);
    }

}
