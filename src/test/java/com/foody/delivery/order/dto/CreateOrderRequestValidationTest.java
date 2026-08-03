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

/**
 * These are the tests for the guarantees nothing else in the stack provides:
 * the migration has no CHECK constraints and {@code OrderItem}'s constructor has no
 * guards, so bean validation on the request DTO is the ONLY thing keeping a
 * zero-quantity or negative-price item out of the database. Each test therefore
 * pins the exact property path the client will see in the {@code errors} extension.
 */
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

    // --- items list itself -------------------------------------------------

    /**
     * Order.place throws IllegalArgumentException on an empty list and
     * ApiExceptionHandler deliberately does not handle it, so without @NotEmpty an
     * empty items array would surface as a 500. This is what makes it a 400.
     */
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

    /** A JSON {@code [null]} element is not a cascade target, so it needs its own guard. */
    @Test
    void nullItemElementIsRejected() {
        CreateOrderRequest request =
                new CreateOrderRequest(Collections.singletonList(null), validAddress());

        assertThat(pathsOf(request)).containsExactly("items[0].<list element>");
    }

    // --- @Valid actually cascades into the nested item list ----------------

    /**
     * If @Valid did not cascade into the list, every per-item constraint below would
     * silently pass and this set would be empty.
     */
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

    // --- quantity >= 1 ------------------------------------------------------

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

    /** The boundary the constraint is supposed to allow: exactly one unit. */
    @Test
    void quantityOfOneIsAccepted() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, 1)))).isEmpty();
    }

    @Test
    void missingQuantityIsRejectedRatherThanDefaultingToZero() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", 4990L, null))))
                .containsExactly("items[0].quantity");
    }

    // --- unitPriceCents >= 0 ------------------------------------------------

    @Test
    void negativeUnitPriceIsRejected() {
        assertThat(pathsOf(requestWith(new OrderItemRequest("Pizza", -1L, 2))))
                .containsExactly("items[0].unitPriceCents");
    }

    /**
     * The spec says {@code unit_price_cents >= 0}, not {@code > 0}: a free item is
     * legal. This pins that the constraint is @Min(0) and never drifts to @Min(1).
     */
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

    // --- delivery address ---------------------------------------------------

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

        assertThat(pathsOf(withDash)).containsExactly("deliveryAddress.zipCode");
    }

    /** complement is the one nullable address field; the valid-request test above
     * already sends it as null, this pins that an empty string is fine too. */
    @Test
    void complementIsOptional() {
        CreateOrderRequest request = new CreateOrderRequest(List.of(validItem()),
                new AddressDto("Rua", "100", "", "Centro", "São Paulo", "SP", "01001000"));

        assertThat(pathsOf(request)).isEmpty();
    }
}
