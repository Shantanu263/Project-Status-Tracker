package com.shantanu.projectstatustracker.models;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @Column(name = "parent_id", nullable = false)
    private Long parentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "parent_type", nullable = false)
    private ParentType parentType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

}

