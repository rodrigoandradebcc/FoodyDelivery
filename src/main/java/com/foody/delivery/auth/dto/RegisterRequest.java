package com.foody.delivery.auth.dto;

import com.foody.delivery.shared.validation.MaxBytes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Email @Size(max = 180) String email,
        // BCrypt caps a password at 72 BYTES, not 72 characters, and throws beyond that.
        // @Size guards the character length; @MaxBytes is the one that actually matches
        // BCrypt's limit, so an accented or emoji password fails validation with a 400
        // naming the field instead of blowing up inside the encoder as an unhandled 500.
        @NotBlank @Size(min = 8, max = 72) @MaxBytes(72) String password) {
}
