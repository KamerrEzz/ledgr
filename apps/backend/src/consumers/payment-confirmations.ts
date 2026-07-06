import { createSubscriber } from "@ledgr/event-bus";
import { db, schema } from "@ledgr/db";
import { eq, sql } from "drizzle-orm";
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

      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT set_config('app.current_tenant_id', ${tenant_id}, true)`,
        );

        const [order] = await tx
          .select()
          .from(schema.orders)
          .where(eq(schema.orders.id, order_id));
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

        await tx
          .update(schema.orders)
          .set({ status: "paid", updatedAt: new Date() })
          .where(eq(schema.orders.id, order_id));

        await tx.insert(schema.orderStatusTransitions).values({
          orderId: order_id,
          tenantId: tenant_id,
          fromStatus: order.status,
          toStatus: "paid",
          reason: "Payment confirmed via event",
        });

        const totalCents = order.totalCents;
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
