// save as script.js -> node script.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

/** CONFIG **/
const ENDPOINT = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const ORIGIN = "https://app.pett.ai";
const JWT = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZxNWl5djgwMGZ2bDEwY3RpbnNjbGhhIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgzMTMyOTksImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21kMTUxdzhtMDQwM2xlMG02NDV1c3JrcSIsImV4cCI6MTc1ODMxNjg5OX0.kTECSrH68_f-cUr9KtLCVI1EQUS-1c2BTeOolkQuJ8JqrO-FQOOYMDN7nrTVsRCsmGMyRgaNRcnEAhKRXkv38A"

// pick mode
const type = "5-socket"; // "5-socket" | "1-socket"

const INTER_MESSAGE_DELAY_MS = 20;
const HEARTBEAT_PING_MS = 3000;
const AUTH_REFRESH_MS = 2000; // re-auth every 15s
const HEALTH_INTERVAL_SECONDS = 500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nonce = () => uuidv4();

/** MESSAGE BUILDERS **/
const makeAuthString = (jwt = JWT) => JSON.stringify({
  type: "AUTH",
  data: { params: { authType: "privy", authHash: { hash: jwt } } },
  nonce: nonce(),
});
const makeEnergyString = () => JSON.stringify({ type: "CONSUMABLES_USE", data: { params: { foodId: "ENERGIZER" } }, nonce: nonce() });
const makePlayString   = () => JSON.stringify({ type: "THROWBALL", data: {}, nonce: nonce() });
const makeBathString   = () => JSON.stringify({ type: "SHOWER", data: {}, nonce: nonce() });
const makeEatString    = () => JSON.stringify({ type: "CONSUMABLES_USE", data: { params: { foodId: "SALAD" } }, nonce: nonce() });
const makeHealthString = () => JSON.stringify({ type: "CONSUMABLES_USE", data: { params: { foodId: "SALAD" } }, nonce: nonce() });

/** RobustSocket **/
class RobustSocket {
  constructor(actionType = null, smart = false) {
    this.actionType = actionType;
    this.smart = smart;
    this.ws = null;
    this.isAlive = false;
    this.heartbeatTimer = null;
    this.authTimer = null;
    this.stopped = false;
    this.lastStats = null;
  }

  async start() { this.stopped = false; await this._connect(); }
  stop() {
    this.stopped = true;
    this._clearTimers();
    try { this.ws?.terminate(); } catch {}
  }

  _clearTimers() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.authTimer) clearInterval(this.authTimer);
    this.heartbeatTimer = this.authTimer = null;
  }

  async _connect() {
    if (this.stopped) return;
    const headers = { Origin: ORIGIN, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

    console.log(`[${this.actionType || "smart"}] connecting...`);
    this.ws = new WebSocket(ENDPOINT, { headers, perMessageDeflate: false });

    this.ws.on("open", async () => await this._onOpen());
    this.ws.on("message", (m) => this._onMessage(m));
    this.ws.on("pong", () => { this.isAlive = true; });
    this.ws.on("close", () => this._onClose());
    this.ws.on("error", (err) => console.error(`[${this.actionType}] error:`, err?.message || err));
  }

  async _onOpen() {
    console.log(`✅ [${this.actionType || "smart"}] socket open`);
    this._sendAuth();

    this.isAlive = true;
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (!this.isAlive) {
        console.warn(`[${this.actionType}] missed pong → reconnecting`);
        try { this.ws.terminate(); } catch {}
        return;
      }
      this.isAlive = false;
      this.ws.ping(() => {});
    }, HEARTBEAT_PING_MS);

    // refresh auth every 15s
    this.authTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this._sendAuth();
    }, AUTH_REFRESH_MS);

    // start loop
    this._runLoop().catch(e => console.error(`[${this.actionType}] loop stopped:`, e?.message));
  }

  _sendAuth() {
    this.ws?.send(makeAuthString());
  }

  _onMessage(raw) {
    try {
      const obj = JSON.parse(raw.toString());
      if (obj.type === "auth_result" && obj.pet?.PetStats) {
        this.lastStats = obj.pet.PetStats;
        console.log(`[${this.actionType || "smart"}] stats`, this.lastStats);
      }
      if (obj?.error) console.warn(`[${this.actionType}] server error:`, obj.error);
    } catch {}
  }

  _onClose() {
    this._clearTimers();
    console.warn(`🔒 [${this.actionType}] socket closed, reconnecting...`);
    if (!this.stopped) setTimeout(() => this._connect(), 2000);
  }

  async _runLoop() {
    while (!this.stopped) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await sleep(500);
        continue;
      }

      if (this.smart) {
        // smart mode → decide based on stats
        const s = this.lastStats;
        if (s) {
          const hunger = parseFloat(s.hunger);
          const energy = parseFloat(s.energy);
          const health = parseFloat(s.health);
          const hygiene = parseFloat(s.hygiene);

          if (hunger < 30) {
            this.ws.send(makeEatString());
          } else if (energy < 30) {
            this.ws.send(makeEnergyString());
          } else if (health < 30) {
            this.ws.send(makeHealthString());
          } else if (hygiene < 30) {
            this.ws.send(makeBathString());
          } else {
            this.ws.send(makePlayString());
          }
        }
      } else {
        // fixed role mode
        switch (this.actionType) {
          case "eat":    this.ws.send(makeEatString()); break;
          case "energy": this.ws.send(makeEnergyString()); break;
          case "play":   this.ws.send(makePlayString()); break;
          case "bath":   this.ws.send(makeBathString()); break;
          case "health": this.ws.send(makeHealthString()); break;
        }
      }

      await sleep(INTER_MESSAGE_DELAY_MS);
    }
  }
}

/** BOOT **/
(async () => {
  if (type === "5-socket") {
    const sockets = [
      new RobustSocket("eat"),
      new RobustSocket("energy"),
      new RobustSocket("play"),
      new RobustSocket("bath"),
      new RobustSocket("health"),
    ];
    for (const s of sockets) s.start();
  } else {
    const smart = new RobustSocket(null, true);
    smart.start();
  }
})();
