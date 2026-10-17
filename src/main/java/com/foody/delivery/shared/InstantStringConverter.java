package com.foody.delivery.shared;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;

@Converter(autoApply = true)
public class InstantStringConverter implements AttributeConverter<Instant, String> {

    static final DateTimeFormatter FIXED_PRECISION =
            new DateTimeFormatterBuilder().appendInstant(9).toFormatter();

    @Override
    public String convertToDatabaseColumn(Instant attribute) {
        return attribute == null ? null : FIXED_PRECISION.format(attribute);
    }

    @Override
    public Instant convertToEntityAttribute(String dbData) {
        return dbData == null ? null : Instant.parse(dbData);
    }
}
