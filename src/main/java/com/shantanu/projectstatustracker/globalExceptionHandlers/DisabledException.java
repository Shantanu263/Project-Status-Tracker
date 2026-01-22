package com.shantanu.projectstatustracker.globalExceptionHandlers;

public class DisabledException extends RuntimeException {
    public DisabledException(String message) {
        super(message);
    }
}
