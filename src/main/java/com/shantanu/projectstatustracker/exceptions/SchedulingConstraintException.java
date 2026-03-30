package com.shantanu.projectstatustracker.exceptions;

/**
 * Exception thrown when a scheduling constraint (dependency date rule) is violated
 * by a user-supplied date that conflicts with a dependency relationship.
 */
public class SchedulingConstraintException extends RuntimeException {
    public SchedulingConstraintException(String message) {
        super(message);
    }
}

