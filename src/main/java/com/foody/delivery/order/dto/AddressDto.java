package com.foody.delivery.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Used for both the request and the response. {@code complement} is the only nullable
 * field, matching the nullability of the {@code addr_complement} column.
 */
public record AddressDto(
        @NotBlank @Size(max = 150) String street,
        @NotBlank @Size(max = 20) String number,
        @Size(max = 150) String complement,
        @NotBlank @Size(max = 100) String district,
        @NotBlank @Size(max = 100) String city,
        @NotBlank @Size(min = 2, max = 2) String state,
        @NotBlank @Size(min = 8, max = 8) String zipCode) {
}
