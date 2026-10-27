import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { publish } from "@floot/realtime";
import { sendPushNotifications } from "@floot/push";
import { schema } from "./incident_POST.schema";
import superjson from "superjson";
type StoredPush = { endpoint: string; keys: { p256dh: string; auth: string } } | { fcmToken: string; platform: string } | { apnsToken: string; platform: string };

function periodStart(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() < 6 ? 0 : 6, 1)); }
function periodEnd(date: Date) { return date.getUTCMonth() < 6 ? new Date(Date.UTC(date.getUTCFullYear(), 6, 0, 23, 59, 59)) : new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 0, 23, 59, 59)); }

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") return new Response(superjson.stringify({ error: "Manager access required" }), { status: 403 });
    const input = schema.parse(superjson.parse(await request.text()));
    const incidentDate = new Date(input.incidentDate);
    const start = periodStart(incidentDate); const end = periodEnd(incidentDate);
    const employee = await db.selectFrom("employees").select(["id", "displayName", "email", "phone"]).where("id", "=", input.employeeId).where("active", "=", true).executeTakeFirst();
    if (!employee) return new Response(superjson.stringify({ error: "Employee not found" }), { status: 404 });
    const existing = await db.selectFrom("attendanceIncidents").select("id").where("employeeId", "=", input.employeeId).where("incidentDate", ">=", start).where("incidentDate", "<=", end).where("classification", "=", "unprotected_attendance_incident").execute();
    const count = input.classification === "unprotected_attendance_incident" ? existing.length + 1 : null;
    const created = await db.transaction().execute(async trx => {
      const row = await trx.insertInto("attendanceIncidents").values({ employeeId: input.employeeId, incidentDate, occurrence: input.occurrence, scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : null, scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : null, actualStart: input.actualStart ? new Date(input.actualStart) : null, actualEnd: input.actualEnd ? new Date(input.actualEnd) : null, hoursMissed: input.hoursMissed ?? null, noticeAt: input.noticeAt ? new Date(input.noticeAt) : null, noticeMethod: input.noticeMethod ?? null, noticeTimely: input.noticeTimely ?? null, employeeReason: input.employeeReason ?? null, protectedLeaveReview: input.protectedLeaveReview, classification: input.classification, action: input.action, managerNotes: input.managerNotes ?? null, employeeComments: input.employeeComments ?? null, sixMonthCount: count, createdByUserId: user.id, updatedByUserId: user.id }).returning(["id", "sixMonthCount", "classification"]).executeTakeFirstOrThrow();
      await trx.insertInto("attendanceAuditLog").values({ incidentId: row.id, employeeId: input.employeeId, actorUserId: user.id, action: "created", details: { occurrence: input.occurrence, classification: input.classification, sixMonthCount: count } }).execute();
      return row;
    });
    await publish("attendance:all", { type: "incident_created", incidentId: created.id, employeeId: input.employeeId });
    const managerSubscriptions = await db.selectFrom("pushSubscriptions as p").innerJoin("users as u", "u.id", "p.userId").select("p.subscription").where("u.role", "=", "admin").execute();
    if (managerSubscriptions.length) {
      const results = await sendPushNotifications(managerSubscriptions.map(r => r.subscription as StoredPush), { title: "Attendance incident", body: `${employee.displayName} has a new attendance incident.`, url: "/", tag: `attendance-${created.id}` });
      for (let i = 0; i < results.length; i++) {
        if (!results[i].gone) continue;
        const sub = managerSubscriptions[i];
        const stored = sub?.subscription as { endpoint?: string; fcmToken?: string; apnsToken?: string } | undefined;
        const identity = stored?.endpoint ?? stored?.fcmToken ?? stored?.apnsToken;
        if (identity) await db.deleteFrom("pushSubscriptions").where("identity", "=", identity).execute();
      }
    }
    return new Response(superjson.stringify(created), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Attendance incident error:", error);
    return new Response(superjson.stringify({ error: "Unable to save attendance incident" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}
