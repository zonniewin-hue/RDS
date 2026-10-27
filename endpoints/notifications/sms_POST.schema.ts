import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ employeeId: z.number().int().positive(), incidentId: z.number().int().positive() });
export type OutputType = { ok: true; sentTo: string };
export const sendAttendanceSms = async (body: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/notifications/sms`, { method: "POST", body: superjson.stringify(schema.parse(body)), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" });
  if (!result.ok) throw new Error((await result.text()) || "Unable to send SMS");
  return superjson.parse<OutputType>(await result.text());
};
