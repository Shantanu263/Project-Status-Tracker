package com.shantanu.projectstatustracker.exceptions;

/**
 * Exception thrown when a user tries to access a resource they don't have permission to access.
 */
public class AccessDeniedException extends RuntimeException {
    public AccessDeniedException(String message) {
        super(message);
    }
}