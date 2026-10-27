import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  employeeId: z.number().int().positive(), incidentDate: z.string(), occurrence: z.string().min(1),
  scheduledStart: z.string().nullable().optional(), scheduledEnd: z.string().nullable().optional(), actualStart: z.string().nullable().optional(), actualEnd: z.string().nullable().optional(),
  hoursMissed: z.number().nonnegative().nullable().optional(), noticeAt: z.string().nullable().optional(), noticeMethod: z.string().nullable().optional(), noticeTimely: z.string().nullable().optional(),
  employeeReason: z.string().nullable().optional(), protectedLeaveReview: z.string().default("no_apparent_issue"), classification: z.string().default("pending_review"), action: z.string().default("none"), managerNotes: z.string().nullable().optional(), employeeComments: z.string().nullable().optional(),
});
export type OutputType = { id: number; sixMonthCount: number | null; classification: string };
export const postAttendanceIncident = async (body: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> => { const validatedInput = schema.parse(body); const result = await fetch(`/_api/attendance/incident`, { method: "POST", body: superjson.stringify(validatedInput), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" }); if (!result.ok) throw new Error((await result.text()) || "Unable to save incident"); return superjson.parse<OutputType>(await result.text()); };
