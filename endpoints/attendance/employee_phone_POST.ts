import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { schema } from "./employee_phone_POST.schema";
import superjson from "superjson";
export async function handle(request: Request) { try { const { user } = await getServerUserSession(request); if (user.role !== "admin") return new Response(superjson.stringify({ error: "Manager access required" }), { status: 403 }); const input = schema.parse(superjson.parse(await request.text())); await db.updateTable("employees").set({ phone: input.phone || null, updatedAt: new Date() }).where("id", "=", input.employeeId).execute(); return new Response(superjson.stringify({ ok: true, phone: input.phone || null }), { headers: { "Content-Type": "application/json" } }); } catch (error) { console.error("Employee phone error:", error); return new Response(superjson.stringify({ error: "Unable to update mobile number" }), { status: 400 }); } }
