package com.foody.delivery.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddressDto(
        @NotBlank @Size(max = 120) String street,
        @NotBlank @Size(max = 120) String number,
        @Size(max = 120) String complement,
        @NotBlank @Size(max = 120) String district,
        @NotBlank @Size(max = 120) String city,
        @NotBlank @Size(min = 2, max = 2) String state,
        @NotBlank @Size(min = 8, max = 8) String zipCode) {
}
