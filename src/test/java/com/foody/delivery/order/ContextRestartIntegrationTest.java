package com.foody.delivery.order;

import com.foody.delivery.FoodyDeliveryApplication;
import com.foody.delivery.TestDatabase;
import com.foody.delivery.order.dto.AddressDto;
import com.foody.delivery.order.dto.CreateOrderRequest;
import com.foody.delivery.order.dto.OrderItemRequest;
import com.foody.delivery.user.User;
import com.foody.delivery.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ContextRestartIntegrationTest {

    static final String JDBC_URL = TestDatabase.newTempSqliteUrl();

    @Test
    void orderSurvivesClosingAndStartingASpringContextOnTheSameDatabase() {
        String orderId;
        try (ConfigurableApplicationContext first = startContext()) {
            User user = first.getBean(UserRepository.class).save(User.register("Rodrigo",
                    "restart-" + UUID.randomUUID() + "@example.com", "hashed-password"));
            CreateOrderRequest request = new CreateOrderRequest("Ana Souza",
                    List.of(new OrderItemRequest("Pizza", 4990L, 2)),
                    new AddressDto("Rua das Flores", "100", null, "Centro", "São Paulo", "SP", "01001000"));
            orderId = first.getBean(OrderService.class).create(user.getId(), request).id();
        }

        try (ConfigurableApplicationContext second = startContext()) {
            assertThat(second.getBean(OrderService.class).getById(orderId).customerName())
                    .isEqualTo("Ana Souza");
            assertThat(second.getBean(OrderService.class).getById(orderId).items()).hasSize(1);
        }
    }

    private ConfigurableApplicationContext startContext() {
        return new SpringApplicationBuilder(FoodyDeliveryApplication.class)
                .web(WebApplicationType.NONE)
                .properties("spring.datasource.url=" + JDBC_URL)
                .run();
    }
}
