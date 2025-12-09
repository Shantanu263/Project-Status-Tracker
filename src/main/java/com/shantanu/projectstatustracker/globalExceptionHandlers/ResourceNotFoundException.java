package com.shantanu.projectstatustracker.globalExceptionHandlers;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
