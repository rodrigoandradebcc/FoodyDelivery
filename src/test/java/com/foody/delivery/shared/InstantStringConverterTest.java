package com.foody.delivery.shared;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class InstantStringConverterTest {

    private final InstantStringConverter converter = new InstantStringConverter();

    @Test
    void nullRoundTripsAsNull() {
        assertThat(converter.convertToDatabaseColumn(null)).isNull();
        assertThat(converter.convertToEntityAttribute(null)).isNull();
    }

    @Test
    void instantRoundTripsWithFullNanosecondPrecision() {
        Instant instant = Instant.parse("2026-07-31T13:00:00.123456789Z");

        assertThat(converter.convertToEntityAttribute(converter.convertToDatabaseColumn(instant)))
                .isEqualTo(instant);
    }

    @Test
    void columnValueAlwaysHasNineFractionalDigits() {
        assertThat(converter.convertToDatabaseColumn(Instant.parse("2026-07-31T13:00:00Z")))
                .isEqualTo("2026-07-31T13:00:00.000000000Z");
        assertThat(converter.convertToDatabaseColumn(Instant.parse("2026-07-31T13:00:00.5Z")))
                .isEqualTo("2026-07-31T13:00:00.500000000Z");
    }

    @Test
    void lexicalOrderOfColumnValuesMatchesChronologicalOrder() {
        String wholeSecond = converter.convertToDatabaseColumn(Instant.parse("2026-07-31T13:00:00Z"));
        String halfSecond = converter.convertToDatabaseColumn(Instant.parse("2026-07-31T13:00:00.500Z"));
        String millis = converter.convertToDatabaseColumn(Instant.parse("2026-07-31T13:00:00.120Z"));
        String micros = converter.convertToDatabaseColumn(Instant.parse("2026-07-31T13:00:00.120456Z"));

        assertThat(wholeSecond).isLessThan(halfSecond);
        assertThat(millis).isLessThan(micros);
    }

    @Test
    void readsValuesWrittenInTheShorterLegacyFormats() {
        assertThat(converter.convertToEntityAttribute("2026-07-31T13:00:00Z"))
                .isEqualTo(Instant.parse("2026-07-31T13:00:00Z"));
        assertThat(converter.convertToEntityAttribute("2026-07-31T13:00:00.123Z"))
                .isEqualTo(Instant.parse("2026-07-31T13:00:00.123Z"));
    }
}
