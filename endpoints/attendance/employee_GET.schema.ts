import superjson from "superjson";

export type OutputType = { employee: { id: number; name: string; position: string | null; phone: string | null; office: string; incidents: Array<Record<string, unknown>> } };
export const getAttendanceEmployee = async (employeeId: number, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/attendance/employee?employeeId=${encodeURIComponent(employeeId)}`, { method: "GET", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" });
  if (!result.ok) throw new Error((await result.text()) || "Unable to load employee record");
  return superjson.parse<OutputType>(await result.text());
};
