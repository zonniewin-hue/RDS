import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";

function currentPeriod() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = month < 6 ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(year, 6, 1));
  const end = month < 6 ? new Date(Date.UTC(year, 6, 0, 23, 59, 59)) : new Date(Date.UTC(year + 1, 0, 0, 23, 59, 59));
  const nextReset = month < 6 ? new Date(Date.UTC(year, 6, 1)) : new Date(Date.UTC(year + 1, 0, 1));
  return { start, end, nextReset };
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const { start, end, nextReset } = currentPeriod();
    const employeeLink = await db.selectFrom("employees").select(["id", "displayName", "position", "officeId"]).where("userId", "=", user.id).where("active", "=", true).limit(1).executeTakeFirst();

    if (user.role !== "admin") {
      if (!employeeLink) return new Response(superjson.stringify({ error: "Manager access required." }), { status: 403, headers: { "Content-Type": "application/json" } });
      const rows = await db.selectFrom("attendanceIncidents as i").innerJoin("employees as e", "e.id", "i.employeeId").innerJoin("offices as o", "o.id", "e.officeId").select([
        "i.id", "i.incidentDate", "i.occurrence", "i.hoursMissed", "i.noticeAt", "i.noticeMethod", "i.noticeTimely", "i.employeeReason", "i.protectedLeaveReview", "i.classification", "i.action", "i.employeeComments", "i.acknowledgedAt", "i.sixMonthCount", "o.name as office"
      ]).where("i.employeeId", "=", employeeLink.id).where("i.incidentDate", ">=", start).where("i.incidentDate", "<=", end).orderBy("i.incidentDate", "desc").execute();
      const count = rows.filter(r => r.classification === "unprotected_attendance_incident").length;
      return new Response(superjson.stringify({ error: "Employee access has been removed. Please use Gusto for your employee attendance information." }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const employees = await db.selectFrom("employees as e").innerJoin("offices as o", "o.id", "e.officeId").select(["e.id", "e.displayName", "e.email", "e.position", "e.phone", "o.name as office"]).where("e.active", "=", true).orderBy("e.displayName").execute();
    const incidents = await db.selectFrom("attendanceIncidents as i").innerJoin("employees as e", "e.id", "i.employeeId").innerJoin("offices as o", "o.id", "e.officeId").innerJoin("users as u", "u.id", "i.createdByUserId").select(["i.id", "i.employeeId", "i.incidentDate", "i.occurrence", "i.classification", "i.sixMonthCount", "u.displayName as manager", "e.displayName as employee", "o.name as office"]).where("i.incidentDate", ">=", start).where("i.incidentDate", "<=", end).orderBy("i.incidentDate", "desc").execute();
    const employeesWithStatus = employees.map(e => {
      const mine = incidents.filter(i => i.employeeId === e.id && i.classification === "unprotected_attendance_incident");
      const count = mine.length;
      return { id: e.id, name: e.displayName, email: e.email, position: e.position, office: e.office, phone: e.phone, incidents: count, lastIncident: mine[0]?.incidentDate ? new Date(mine[0].incidentDate).toISOString().slice(0,10) : null, status: count >= 3 ? "Review" : count === 2 ? "Watch" : "Good" as "Good" | "Watch" | "Review" };
    });
    return new Response(superjson.stringify({ viewer: { id: user.id, role: user.role, employeeId: null }, period: { start: start.toISOString(), end: end.toISOString(), nextReset: nextReset.toISOString() }, employees: employeesWithStatus, recentIncidents: incidents.slice(0, 8).map(i => ({ id: i.id, employee: i.employee, type: i.occurrence, date: new Date(i.incidentDate).toISOString().slice(0,10), count: i.sixMonthCount, manager: i.manager })) }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Attendance overview error:", error);
    return new Response(superjson.stringify({ error: "Unable to load attendance records" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}
