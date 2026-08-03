package com.foody.delivery.shared.exception;

public class ConflictException extends RuntimeException {

    private final String title;

    public ConflictException(String title, String detail) {
        super(detail);
        this.title = title;
    }

    public String getTitle() {
        return title;
    }
}
