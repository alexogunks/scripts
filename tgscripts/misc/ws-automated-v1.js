// save as script.js -> node script.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const ENDPOINT = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const ORIGIN = "https://app.pett.ai";
const JWT = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZxNWl5djgwMGZ2bDEwY3RpbnNjbGhhIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgzMDkxNDIsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21kMTUxdzhtMDQwM2xlMG02NDV1c3JrcSIsImV4cCI6MTc1ODMxMjc0Mn0.r-QhYCB0kuTAaXbeLZLs2--Ct96TAasQ1hWodjZHCIAbDwcnaeVsjDfG-K_Q-po_ol5tMTzqMMXJt7Jj7K5fzg"

const INTER_MESSAGE_DELAY_MS = 20;
const HEARTBEAT_PING_MS = 30000;
const RECONNECT_DELAY_MS = 2000; // immediate-ish reconnect

// counts / pacing
const SEQ_COUNTS = {
  eat: 2,
  energy: 1,
  play: 5,
  bath: 3,
};
const HEALTH_INTERVAL_SECONDS = 500;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const nonce = () => uuidv4();

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

/**
 * One RobustSocket = one dedicated action loop
 */
class RobustSocket {
  constructor(actionType) {
    this.actionType = actionType;
    this.ws = null;
    this.isAlive = false;
    this.heartbeatTimer = null;
    this.stopped = false;
  }

  async start() {
    this.stopped = false;
    await this._connect();
  }

  stop() {
    this.stopped = true;
    this._clearTimers();
    try { this.ws?.terminate(); } catch {}
  }

  _clearTimers() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  async _connect() {
    if (this.stopped) return;
    const headers = { Origin: ORIGIN, "User-Agent": "node/ws" };

    console.log(`[${this.actionType}] connecting...`);
    this.ws = new WebSocket(ENDPOINT, { headers, perMessageDeflate: false });

    this.ws.on("open", async () => await this._onOpen());
    this.ws.on("message", (m) => this._onMessage(m));
    this.ws.on("pong", () => { this.isAlive = true; });
    this.ws.on("close", () => this._onClose());
    this.ws.on("error", (err) => console.error(`[${this.actionType}] error:`, err?.message || err));
  }

  async _onOpen() {
    console.log(`✅ [${this.actionType}] socket open`);
    this.ws.send(makeAuthString());
    await sleep(250);

    this.isAlive = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
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

    this._runLoop().catch(e => console.error(`[${this.actionType}] loop stopped:`, e?.message));
  }

  _onMessage(raw) {
    try {
      const obj = JSON.parse(raw.toString());
      // console.log(obj)
      if (obj?.error) console.warn(`[${this.actionType}] server error:`, obj.error);
    } catch {}
  }

  _onClose() {
    this._clearTimers();
    console.warn(`🔒 [${this.actionType}] socket closed, reconnecting soon...`);
    if (!this.stopped) {
      setTimeout(() => this._connect(), RECONNECT_DELAY_MS);
    }
  }

  async _runLoop() {
    while (!this.stopped) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await sleep(500);
        continue;
      }

      switch (this.actionType) {
        case "eat":
          for (let i = 0; i < SEQ_COUNTS.eat; i++) {
            this.ws.send(makeEatString());
            await sleep(INTER_MESSAGE_DELAY_MS);
          }
          break;
        case "energy":
          for (let i = 0; i < SEQ_COUNTS.energy; i++) {
            this.ws.send(makeEnergyString());
            await sleep(INTER_MESSAGE_DELAY_MS);
          }
          break;
        case "play":
          for (let i = 0; i < SEQ_COUNTS.play; i++) {
            this.ws.send(makePlayString());
            if ((i + 1) % 100 === 0) await sleep(150);
            await sleep(INTER_MESSAGE_DELAY_MS);
          }
          break;
        case "bath":
          for (let i = 0; i < SEQ_COUNTS.bath; i++) {
            this.ws.send(makeBathString());
            await sleep(INTER_MESSAGE_DELAY_MS);
          }
          break;
        case "health":
          this.ws.send(makeHealthString());
          console.log(`[${this.actionType}] health tick`);
          await sleep(HEALTH_INTERVAL_SECONDS * 1000);
          break;
      }

      // small delay between cycles
      if (this.actionType !== "health") await sleep(100);
    }
  }
}

/**
 * Boot 5 sockets, each with its own role
 */
(async () => {
  const sockets = [
    new RobustSocket("eat"),
    new RobustSocket("energy"),
    new RobustSocket("play"),
    new RobustSocket("bath"),
    new RobustSocket("health"),
  ];
  for (const s of sockets) s.start();
})();
