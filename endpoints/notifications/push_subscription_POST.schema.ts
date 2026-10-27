import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  action: z.enum(["save", "delete"]),
  identity: z.string().min(1),
  subscription: z.record(z.unknown()).optional(),
});
export type OutputType = { ok: true };
export const postPushSubscription = async (body: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/notifications/push_subscription`, { method: "POST", body: superjson.stringify(schema.parse(body)), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" });
  if (!result.ok) throw new Error((await result.text()) || "Unable to update notifications");
  return superjson.parse<OutputType>(await result.text());
};
