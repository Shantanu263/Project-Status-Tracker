package com.shantanu.projectstatustracker.globalExceptionHandlers;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Arrays;
import java.util.Map;

@RestControllerAdvice
public class MyControllerAdvice {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String,String>> resourceNotFound(ResourceNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message",e.getMessage()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Object> handleInvalidEnum(HttpMessageNotReadableException ex) {
        Throwable cause = ex.getCause();
        if (cause instanceof InvalidFormatException ife && ife.getTargetType().isEnum()) {
            Class<?> enumType = ife.getTargetType();
            String invalidValue = String.valueOf(ife.getValue());
            String allowedValues = Arrays.toString(enumType.getEnumConstants());

            String message = String.format(
                    "Invalid value '%s' for enum %s. Allowed values: %s",
                    invalidValue, enumType.getSimpleName(), allowedValues
            );

            return ResponseEntity
                    .badRequest()
                    .body(Map.of("error", message));
        }

        // Fallback for other JSON errors
        return ResponseEntity
                .badRequest()
                .body(Map.of("error", "Malformed JSON request"));
    }

}
