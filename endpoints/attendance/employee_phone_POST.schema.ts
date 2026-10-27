import { z } from "zod";
import superjson from "superjson";
export const schema = z.object({ employeeId: z.number().int().positive(), phone: z.string().trim().max(30).nullable() });
export type OutputType = { ok: true; phone: string | null };
export const updateEmployeePhone = async (body: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> => { const result = await fetch(`/_api/attendance/employee_phone`, { method: "POST", body: superjson.stringify(schema.parse(body)), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" }); if (!result.ok) throw new Error((await result.text()) || "Unable to update mobile number"); return superjson.parse<OutputType>(await result.text()); };
