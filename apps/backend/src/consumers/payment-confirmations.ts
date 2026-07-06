import { createSubscriber } from "@ledgr/event-bus";
import { sql } from "@ledgr/db";
import { canTransition } from "../services/order-state-machine.js";
import { createSplitPaymentEntries } from "../services/ledger.js";

export function startPaymentConsumer(): void {
  const subscriber = createSubscriber();

  subscriber.subscribe("payment:confirmed", (err) => {
    if (err) {
      console.error("Failed to subscribe to payment:confirmed:", err);
      return;
    }
    console.log("Listening for payment:confirmed events");
  });

  subscriber.on("message", async (channel, message) => {
    if (channel !== "payment:confirmed") return;

    try {
      const { order_id, tenant_id, status } = JSON.parse(message);

      if (status !== "paid") {
        console.log(`Ignoring payment event with status: ${status}`);
        return;
      }

      await sql.begin(async (tx) => {
        await tx`SELECT set_config('app.current_tenant_id', ${tenant_id}, true)`;

        const [order] = await tx`SELECT * FROM orders WHERE id = ${order_id}`;
        if (!order) {
          console.error(`Order ${order_id} not found`);
          return;
        }

        if (!canTransition(order.status, "paid")) {
          console.error(
            `Cannot transition order ${order_id} from ${order.status} to paid`,
          );
          return;
        }

        await tx`UPDATE orders SET status = 'paid', updated_at = now() WHERE id = ${order_id}`;

        await tx`INSERT INTO order_status_transitions (order_id, tenant_id, from_status, to_status, reason)
          VALUES (${order_id}, ${tenant_id}, ${order.status}, 'paid', 'Payment confirmed via event')`;

        const totalCents = BigInt(order.total_cents);
        await createSplitPaymentEntries(
          tx,
          order_id,
          tenant_id,
          totalCents,
          order.currency,
        );

        console.log(`Order ${order_id} transitioned to paid`);
      });
    } catch (err) {
      console.error("Error processing payment confirmation:", err);
    }
  });
}
