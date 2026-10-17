package com.foody.delivery.order.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class CreateOrderRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static AddressDto validAddress() {
        return new AddressDto("Rua das Flores", "100", null, "Centro",
                "São Paulo", "SP", "01001000");
    }

    private static OrderItemRequest validItem() {
        return new OrderItemRequest("Pizza Calabresa", 4990L, 2);
    }

    private static CreateOrderRequest requestWith(OrderItemRequest... items) {
        return new CreateOrderRequest(Arrays.asList(items), validAddress());
    }

    private static List<String> pathsOf(CreateOrderRequest request) {
        return validator.validate(request).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .sorted()
                .toList();
    }

    @Test
    void aWellFormedRequestHasNoViolations() {
        Set<ConstraintViolation<CreateOrderRequest>> violations =
                validator.validate(requestWith(validItem()));

        assertThat(violations).isEmpty();
    }

    @Test
    void emptyItemsListIsRejected() {
        CreateOrderRequest request = new CreateOrderRequest(List.of(), validAddress());

        assertThat(pathsOf(request)).containsExactly("items");
    }

    @Test
    void nullItemsListIsRejected() {
        CreateOrderRequest request = new CreateOrderRequest(null, validAddress());

        assertThat(pathsOf(request)).containsExactly("items");
    }

    @Test
    void nullItemElementIsRejected() {
        CreateOrderRequest request =
                new CreateOrderRequest(Collections.singletonList(null), validAddress());

        assertThat(pathsOf(request)).containsExactly("items[0].<list element>");
    }

    @Test
    void perItemConstraintsRunBecauseValidCascadesIntoTheList() {
        CreateOrderRequest request = requestWith(new OrderItemRequest("  ", -1L, 0));

        assertThat(pathsOf(request)).containsExactly(
                "items[0].productName", "items[0].quantity", "items[0].unitPriceCents");
    }

    @Test
    void cascadeReachesEveryItemNotJustTheFirst() {
        CreateOrderRequest request = requestWith(validItem(), new OrderItemRequest("Coca", 500L, 0));

        assertThat(pathsOf(request)).containsExactly("items[1].quantity");
    }

    @Test
    void zeroQuantityIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, 0))))
                .containsExactly("items[0].quantity");
    }

    @Test
    void negativeQuantityIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, -3))))
                .containsExactly("items[0].quantity");
    }

    @Test
    void quantityOfOneIsAccepted() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, 1)))).isEmpty();
    }

    @Test
    void missingQuantityIsRejectedRatherThanDefaultingToZero() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, null))))
                .containsExactly("items[0].quantity");
    }

    @Test
    void negativeUnitPriceIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", -1L, 2))))
                .containsExactly("items[0].unitPriceCents");
    }

    @Test
    void zeroUnitPriceIsAccepted() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Brinde", 0L, 1)))).isEmpty();
    }

    @Test
    void missingUnitPriceIsRejectedRatherThanDefaultingToZero() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", null, 2))))
                .containsExactly("items[0].unitPriceCents");
    }

    @Test
    void unitPriceAboveOneMillionReaisIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 100_000_001L, 1))))
                .containsExactly("items[0].unitPriceCents");
    }

    @Test
    void unitPriceOfExactlyOneMillionReaisIsAccepted() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 100_000_000L, 1)))).isEmpty();
    }

    @Test
    void quantityAboveOneThousandIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, 1001))))
                .containsExactly("items[0].quantity");
    }

    @Test
    void quantityOfExactlyOneThousandIsAccepted() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, 1000)))).isEmpty();
    }

    @Test
    void blankProductNameIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("   ", 4990L, 2))))
                .containsExactly("items[0].productName");
    }

    @Test
    void overlongProductNameIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("x".repeat(151), 4990L, 2))))
                .containsExactly("items[0].productName");
    }

    @Test
    void productNameAtTheLimitIsAccepted() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("x".repeat(150), 4990L, 2)))).isEmpty();
    }

    @Test
    void nullDeliveryAddressIsRejected() {
        CreateOrderRequest request = new CreateOrderRequest(List.of(validItem()), null);

        assertThat(pathsOf(request)).containsExactly("deliveryAddress");
    }

    @Test
    void addressConstraintsRunBecauseValidCascadesIntoTheAddress() {
        CreateOrderRequest request = new CreateOrderRequest(List.of(validItem()),
                new AddressDto("", "100", null, "Centro", "São Paulo", "SP", "01001000"));

        assertThat(pathsOf(request)).containsExactly("deliveryAddress.street");
    }

    @Test
    void stateMustBeExactlyTwoCharacters() {
        CreateOrderRequest tooLong = new CreateOrderRequest(List.of(validItem()),
                new AddressDto("Rua", "100", null, "Centro", "São Paulo", "SPX", "01001000"));
        CreateOrderRequest tooShort = new CreateOrderRequest(List.of(validItem()),
                new AddressDto("Rua", "100", null, "Centro", "São Paulo", "S", "01001000"));

        assertThat(pathsOf(tooLong)).containsExactly("deliveryAddress.state");
        assertThat(pathsOf(tooShort)).containsExactly("deliveryAddress.state");
    }

    @Test
    void zipCodeMustBeExactlyEightCharacters() {
        CreateOrderRequest withDash = new CreateOrderRequest(List.of(validItem()),
                new AddressDto("Rua", "100", null, "Centro", "São Paulo", "SP", "01001-000"));
        CreateOrderRequest tooShort = new CreateOrderRequest(List.of(validItem()),
                new AddressDto("Rua", "100", null, "Centro", "São Paulo", "SP", "0100100"));

        assertThat(pathsOf(withDash)).containsExactly("deliveryAddress.zipCode");
        assertThat(pathsOf(tooShort)).containsExactly("deliveryAddress.zipCode");
    }

    @Test
    void complementIsOptional() {
        CreateOrderRequest request = new CreateOrderRequest(List.of(validItem()),
                new AddressDto("Rua", "100", "", "Centro", "São Paulo", "SP", "01001000"));

        assertThat(pathsOf(request)).isEmpty();
    }
}
