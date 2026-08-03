package com.foody.delivery.shared.exception;

public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String detail) {
        super(detail);
    }
}
