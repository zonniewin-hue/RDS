import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema } from "./sms_POST.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") return new Response(superjson.stringify({ error: "Manager access required" }), { status: 403 });
    const input = schema.parse(superjson.parse(await request.text()));
    const employee = await db.selectFrom("employees").select(["id", "displayName", "phone"]).where("id", "=", input.employeeId).where("active", "=", true).executeTakeFirst();
    if (!employee?.phone) return new Response(superjson.stringify({ error: "This employee does not have a mobile number on file." }), { status: 400 });
    const incident = await db.selectFrom("attendanceIncidents").select(["id", "incidentDate", "occurrence", "sixMonthCount"]).where("id", "=", input.incidentId).where("employeeId", "=", input.employeeId).executeTakeFirst();
    if (!incident) return new Response(superjson.stringify({ error: "Incident not found" }), { status: 404 });
    const now = new Date(incident.incidentDate); const nextReset = now.getUTCMonth() < 6 ? new Date(Date.UTC(now.getUTCFullYear(), 6, 1)) : new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
    const date = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(now);
    const reset = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }).format(nextReset);
    const body = `Employee Attendance update for ${employee.displayName}: ${date} — ${incident.occurrence}. Your current attendance incident count for this six-month period is ${incident.sixMonthCount ?? 0}. The period resets ${reset}. Questions? Please contact your office manager.`;
    const env = process.env as Record<string, string | undefined>; const sid = env.TWILIO_ACCOUNT_SID; const token = env.TWILIO_AUTH_TOKEN; const from = env.TWILIO_FROM_NUMBER;
    if (!sid || !token || !from) return new Response(superjson.stringify({ error: "SMS service is not connected yet." }), { status: 503 });
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({ To: employee.phone, From: from, Body: body });
    const twilio = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    if (!twilio.ok) { const detail = await twilio.text(); console.error("Twilio SMS failed", detail); return new Response(superjson.stringify({ error: "SMS could not be sent." }), { status: 502 }); }
    await db.insertInto("attendanceAuditLog").values({ incidentId: input.incidentId, employeeId: input.employeeId, actorUserId: user.id, action: "sms_sent", details: { destination: "employee_mobile", provider: "twilio" } }).execute();
    return new Response(superjson.stringify({ ok: true, sentTo: employee.phone.slice(-4) }), { headers: { "Content-Type": "application/json" } });
  } catch (error) { console.error("Attendance SMS error:", error); return new Response(superjson.stringify({ error: "Unable to send attendance SMS" }), { status: 400 }); }
}
