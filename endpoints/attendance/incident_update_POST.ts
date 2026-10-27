import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { publish } from "@floot/realtime";
import { schema } from "./incident_update_POST.schema";
import superjson from "superjson";

function periodBounds(date: Date) { const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() < 6 ? 0 : 6, 1)); const end = date.getUTCMonth() < 6 ? new Date(Date.UTC(date.getUTCFullYear(), 6, 0, 23, 59, 59)) : new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 0, 23, 59, 59)); return { start, end }; }
export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request); if (user.role !== "admin") return new Response(superjson.stringify({ error: "Manager access required" }), { status: 403 });
    const input = schema.parse(superjson.parse(await request.text())); const incident = await db.selectFrom("attendanceIncidents").select(["id", "employeeId"]).where("id", "=", input.incidentId).executeTakeFirst(); if (!incident) return new Response(superjson.stringify({ error: "Incident not found" }), { status: 404 });
    const incidentDate = new Date(input.incidentDate); const { start, end } = periodBounds(incidentDate); const countRows = await db.selectFrom("attendanceIncidents").select("id").where("employeeId", "=", incident.employeeId).where("incidentDate", ">=", start).where("incidentDate", "<=", end).where("classification", "=", "unprotected_attendance_incident").where("id", "!=", input.incidentId).execute(); const count = input.classification === "unprotected_attendance_incident" ? countRows.length + 1 : null;
    await db.transaction().execute(async trx => { await trx.updateTable("attendanceIncidents").set({ incidentDate, occurrence: input.occurrence, scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null, scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null, actualStart: input.actualStart ? new Date(input.actualStart) : null, actualEnd: input.actualEnd ? new Date(input.actualEnd) : null, hoursMissed: input.hoursMissed ?? null, noticeAt: input.noticeAt ? new Date(input.noticeAt) : null, noticeMethod: input.noticeMethod ?? null, noticeTimely: input.noticeTimely ?? null, employeeReason: input.employeeReason ?? null, protectedLeaveReview: input.protectedLeaveReview, classification: input.classification, action: input.action, employeeComments: input.employeeComments ?? null, managerNotes: input.managerNotes ?? null, sixMonthCount: count, updatedByUserId: user.id, updatedAt: new Date() }).where("id", "=", input.incidentId).execute(); await trx.insertInto("attendanceAuditLog").values({ incidentId: input.incidentId, employeeId: incident.employeeId, actorUserId: user.id, action: "updated", details: { classification: input.classification, sixMonthCount: count } }).execute(); });
    await publish("attendance:all", { type: "incident_updated", incidentId: input.incidentId, employeeId: incident.employeeId });
    return new Response(superjson.stringify({ id: input.incidentId, sixMonthCount: count, classification: input.classification }), { headers: { "Content-Type": "application/json" } });
  } catch (error) { console.error("Attendance update error:", error); return new Response(superjson.stringify({ error: "Unable to update attendance incident" }), { status: 400 }); }
}
