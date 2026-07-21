/* TOLTALES online rooms (§14): one KV blob per room, 4-digit code, trust-the-client.
   Routes: POST /api/create {settings}            -> {code, token, slot:0}
           POST /api/join   {code}                -> {token, slot, need}
           GET  /api/state?code&token&since       -> lobby/game status (+state when newer)
           POST /api/start  {code,token,state,humanSeats}  host only, lobby must be full
           POST /api/submit {code,token,state,handoff}     any seated player
   Rooms expire after 3 idle days (KV TTL refreshed on every write).                    */
const TTL = 60 * 60 * 24 * 3;
const J = (o, s = 200) => new Response(JSON.stringify(o), {
  status: s,
  headers: {
    "content-type": "application/json",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
  },
});
const need = (room) => Math.max(2, Math.min(4, parseInt(room.settings && room.settings.humans, 10) || 2));

export async function onRequest({ request, env, params }) {
  if (request.method === "OPTIONS") return J({ ok: true });
  const route = (params.route || []).join("/");
  const url = new URL(request.url);
  const kv = env.ROOMS;
  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const getRoom = async (c) => { const r = await kv.get("room:" + c); return r ? JSON.parse(r) : null; };
  const putRoom = (room) => kv.put("room:" + room.code, JSON.stringify(room), { expirationTtl: TTL });

  if (route === "create" && request.method === "POST") {
    let code = null;
    for (let i = 0; i < 20; i++) {
      const c = String(Math.floor(1000 + Math.random() * 9000));
      if (!(await getRoom(c))) { code = c; break; }
    }
    if (!code) return J({ error: "No room codes free right now" }, 503);
    const token = crypto.randomUUID();
    const room = { code, phase: "lobby", createdAt: Date.now(), settings: body.settings || {},
      players: [{ token }], seatOf: null, version: 1, handoff: false, state: null };
    await putRoom(room);
    return J({ code, token, slot: 0 });
  }

  const code = String(body.code || url.searchParams.get("code") || "").trim();
  const room = await getRoom(code);
  if (!room) return J({ error: "No such room" }, 404);

  if (route === "join" && request.method === "POST") {
    if (room.phase !== "lobby") return J({ error: "That telling already began" }, 409);
    if (room.players.length >= need(room)) return J({ error: "Lobby is full" }, 409);
    const token = crypto.randomUUID();
    room.players.push({ token });
    await putRoom(room);
    return J({ token, slot: room.players.length - 1, need: need(room) });
  }

  if (route === "state") {
    const token = url.searchParams.get("token") || body.token || "";
    const since = parseInt(url.searchParams.get("since") || "0", 10) || 0;
    const base = {
      code: room.code, phase: room.phase, joined: room.players.length, need: need(room),
      settings: room.settings, version: room.version, handoff: room.handoff,
      yourSeat: room.seatOf && token ? (room.seatOf[token] !== undefined ? room.seatOf[token] : null) : null,
    };
    if (room.phase === "playing" && room.version > since) base.state = room.state;
    return J(base);
  }

  if (route === "start" && request.method === "POST") {
    if (!room.players.length || body.token !== room.players[0].token) return J({ error: "Only the host may start" }, 403);
    if (room.players.length < need(room)) return J({ error: "The lobby is not full yet" }, 409);
    room.phase = "playing";
    room.state = body.state;
    room.handoff = false;
    room.seatOf = {};
    (body.humanSeats || []).forEach((seat, i) => { const p = room.players[i]; if (p) room.seatOf[p.token] = seat; });
    room.version++;
    await putRoom(room);
    return J({ ok: true, version: room.version });
  }

  if (route === "submit" && request.method === "POST") {
    if (room.phase !== "playing") return J({ error: "Not started" }, 409);
    if (!room.players.some((p) => p.token === body.token)) return J({ error: "Not seated in this room" }, 403);
    room.state = body.state;
    room.handoff = !!body.handoff;
    room.version++;
    await putRoom(room);
    return J({ ok: true, version: room.version });
  }

  return J({ error: "Unknown route" }, 404);
}
