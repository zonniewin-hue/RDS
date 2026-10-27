import superjson from "superjson";

export type OutputType = {
  viewer: { id: number; role: "admin" | "user"; employeeId: number | null };
  period: { start: string; end: string; nextReset: string };
  employees: Array<{
    id: number; name: string; email: string | null; position: string | null; office: string;
    incidents: number; lastIncident: string | null; status: "Good" | "Watch" | "Review"; phone: string | null;
  }>;
  recentIncidents: Array<{ id: number; employee: string; type: string; date: string; count: number | null; manager: string }>;
  myRecord?: { employeeId: number; name: string; position: string | null; office: string; incidents: Array<Record<string, unknown>>; count: number };
} | { error: string };

export const getAttendanceOverview = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/attendance/overview`, { method: "GET", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" });
  if (!result.ok) throw new Error((await result.text()) || "Unable to load attendance");
  return superjson.parse<OutputType>(await result.text());
};
