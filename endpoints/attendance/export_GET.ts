import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "admin") return new Response(superjson.stringify({ error: "Manager access required." }), { status: 403, headers: { "Content-Type": "application/json" } });
    const [employees, offices, incidents] = await Promise.all([
      db.selectFrom("employees").selectAll().orderBy("displayName").execute(),
      db.selectFrom("offices").selectAll().orderBy("name").execute(),
      db.selectFrom("attendanceIncidents as i").innerJoin("employees as e", "e.id", "i.employeeId").innerJoin("offices as o", "o.id", "e.officeId").innerJoin("users as u", "u.id", "i.createdByUserId").select([
        "i.id", "i.employeeId", "e.displayName as employeeName", "o.name as office", "i.incidentDate", "i.occurrence", "i.hoursMissed", "i.employeeReason", "i.employeeComments", "i.managerNotes", "i.classification", "i.protectedLeaveReview", "i.action", "i.scheduledStart", "i.scheduledEnd", "i.actualStart", "i.actualEnd", "i.noticeAt", "i.noticeMethod", "i.noticeTimely", "i.sixMonthCount", "i.acknowledgedAt", "i.createdAt", "i.updatedAt", "u.displayName as createdBy"
      ]).orderBy("i.incidentDate", "desc").execute(),
    ]);
    return new Response(superjson.stringify({ exportedAt: new Date().toISOString(), employees, offices, incidents }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Attendance export error:", error);
    return new Response(superjson.stringify({ error: "Unable to export attendance data" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
}