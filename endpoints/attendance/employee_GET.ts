import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";

function currentPeriod() { const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() < 6 ? 0 : 6, 1)); const end = now.getUTCMonth() < 6 ? new Date(Date.UTC(now.getUTCFullYear(), 6, 0, 23, 59, 59)) : new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 0, 23, 59, 59)); return { start, end }; }
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request); const employeeId = Number(new URL(request.url).searchParams.get("employeeId")); if (!employeeId) return new Response(superjson.stringify({ error: "Employee id required" }), { status: 400 });
    const linked = await db.selectFrom("employees").select("id").where("userId", "=", user.id).executeTakeFirst(); if (user.role !== "admin" && linked?.id !== employeeId) return new Response(superjson.stringify({ error: "Access denied" }), { status: 403 });
    const employee = await db.selectFrom("employees as e").innerJoin("offices as o", "o.id", "e.officeId").select(["e.id", "e.displayName", "e.position", "e.phone", "o.name as office"]).where("e.id", "=", employeeId).executeTakeFirst(); if (!employee) return new Response(superjson.stringify({ error: "Employee not found" }), { status: 404 });
    const { start, end } = currentPeriod(); const incidents = await db.selectFrom("attendanceIncidents as i").select(["i.id", "i.incidentDate", "i.occurrence", "i.hoursMissed", "i.noticeAt", "i.noticeMethod", "i.noticeTimely", "i.employeeReason", "i.protectedLeaveReview", "i.classification", "i.action", "i.managerNotes", "i.employeeComments", "i.sixMonthCount", "i.acknowledgedAt"]).where("i.employeeId", "=", employeeId).where("i.incidentDate", ">=", start).where("i.incidentDate", "<=", end).orderBy("i.incidentDate", "desc").execute();
    return new Response(superjson.stringify({ employee: { id: employee.id, name: employee.displayName, position: employee.position, phone: employee.phone, office: employee.office, incidents } }), { headers: { "Content-Type": "application/json" } });
  } catch (error) { console.error("Attendance employee error:", error); return new Response(superjson.stringify({ error: "Unable to load employee record" }), { status: 400 }); }
}
