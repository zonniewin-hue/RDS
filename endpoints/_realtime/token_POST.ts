import { createToken } from "@floot/realtime";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";

// Mints a realtime token for the current connection. Who the user is and which
// channels they may access are both yours to set.
//
// Identity (userId — what presence reports as online). Pick a source:
//  - logged-in: read your session, e.g.
//      const userId = (await getServerSession(request))?.user.id;
//  - anonymous: an id you generate (crypto.randomUUID()). To keep it stable across
//      reconnects, persist it — e.g. set + read a cookie here, or have the client
//      store it and send it (see the next option).
//  - from the client: add fields to the schema (token_POST.schema), read them off
//      the request body here, and pass them where RealtimeClient calls
//      postRealtimeToken().
const json = (data: unknown, status = 200) =>
  new Response(superjson.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function handle(request: Request) {
  let userId: string;
  try {
    const { user } = await getServerUserSession(request);
    userId = String(user.id);
  } catch {
    return json({ error: "Not authenticated" }, 401);
  }

  // Grant only the channels this user may access, matching your channels.* builders.
  // Shared rooms: ["room:*", "__presence:*"] is enough — the room code is the join secret.
  // Private/role-scoped apps (logins, per-user data): grant specific ids from the
  // session/role — e.g. an operator gets the team/presence channels, a customer gets
  // only its own thread. Don't grant a blanket "topic:*" or an internal presence
  // channel to everyone; that's how every user ends up subscribed to every thread.
  const channels: string[] = ["attendance:all"];

  const result = await createToken({ userId, channels, ttlSeconds: 3600 });
  if (!result.ok) {
    return json({ error: result.error.message }, 500);
  }
  return json({ token: result.token, wssEndpoint: result.wssEndpoint, userId });
}
