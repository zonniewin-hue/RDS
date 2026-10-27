import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema } from "./push_subscription_POST.schema";
import superjson from "superjson";
import type { JsonObject } from "../../helpers/schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    if (input.action === "delete") {
      await db.deleteFrom("pushSubscriptions").where("userId", "=", user.id).where("identity", "=", input.identity).execute();
    } else {
      if (!input.subscription) return new Response(superjson.stringify({ error: "Subscription required" }), { status: 400 });
      await db.insertInto("pushSubscriptions").values({ userId: user.id, identity: input.identity, subscription: input.subscription as JsonObject }).onConflict(oc => oc.column("identity").doUpdateSet({ userId: user.id, subscription: input.subscription as JsonObject, updatedAt: new Date() })).execute();
    }
    return new Response(superjson.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Push subscription error:", error);
    return new Response(superjson.stringify({ error: "Unable to update notification subscription" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}
