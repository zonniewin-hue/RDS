import superjson from "superjson";

export type OutputType = {
  exportedAt: string;
  employees: Array<Record<string, unknown>>;
  offices: Array<Record<string, unknown>>;
  incidents: Array<Record<string, unknown>>;
};

export const getAttendanceExport = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/attendance/export`, { method: "GET", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, credentials: "include" });
  if (!result.ok) throw new Error((await result.text()) || "Unable to export attendance data");
  return superjson.parse<OutputType>(await result.text());
};