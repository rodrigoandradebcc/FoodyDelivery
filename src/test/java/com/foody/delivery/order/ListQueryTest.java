package com.foody.delivery.order;

import com.foody.delivery.order.OrderController.ListQuery;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ListQueryTest {

    @Test
    void absentPageAndSizeDefaultToFirstPageOfTwenty() {
        ListQuery query = new ListQuery(null, null, null);

        assertThat(query.status()).isNull();
        assertThat(query.page()).isZero();
        assertThat(query.size()).isEqualTo(20);
    }

    @Test
    void explicitValuesAreKept() {
        ListQuery query = new ListQuery(OrderStatus.ENTREGUE, 3, 50);

        assertThat(query.status()).isEqualTo(OrderStatus.ENTREGUE);
        assertThat(query.page()).isEqualTo(3);
        assertThat(query.size()).isEqualTo(50);
    }
}
