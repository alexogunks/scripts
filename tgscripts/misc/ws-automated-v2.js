// save as script.js -> node script.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

const ENDPOINT = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const ORIGIN = "https://app.pett.ai";
const JWT = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZxNWl5djgwMGZ2bDEwY3RpbnNjbGhhIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgzMDkxNDIsImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21kMTUxdzhtMDQwM2xlMG02NDV1c3JrcSIsImV4cCI6MTc1ODMxMjc0Mn0.r-QhYCB0kuTAaXbeLZLs2--Ct96TAasQ1hWodjZHCIAbDwcnaeVsjDfG-K_Q-po_ol5tMTzqMMXJt7Jj7K5fzg"

const INTER_MESSAGE_DELAY_MS = 100;
const HEARTBEAT_PING_MS = 30000;
const RECONNECT_DELAY_MS = 2000;

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

class RobustSocket {
  constructor() {
    this.ws = null;
    this.isAlive = false;
    this.heartbeatTimer = null;
    this.stopped = false;
    this.latestStats = null;
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

    console.log(`[main] connecting...`);
    this.ws = new WebSocket(ENDPOINT, { headers, perMessageDeflate: false });

    this.ws.on("open", async () => await this._onOpen());
    this.ws.on("message", (m) => this._onMessage(m));
    this.ws.on("pong", () => { this.isAlive = true; });
    this.ws.on("close", () => this._onClose());
    this.ws.on("error", (err) => console.error(`[main] error:`, err?.message || err));
  }

  async _onOpen() {
    console.log(`✅ [main] socket open`);
    this.ws.send(makeAuthString());
    await sleep(250);

    this.isAlive = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (!this.isAlive) {
        console.warn(`[main] missed pong → reconnecting`);
        try { this.ws.terminate(); } catch {}
        return;
      }
      this.isAlive = false;
      this.ws.ping(() => {});
    }, HEARTBEAT_PING_MS);

    // main loop
    this._runLoop().catch(e => console.error(`[main] loop stopped:`, e?.message));
  }

  _onMessage(raw) {
    try {
      const obj = JSON.parse(raw.toString());
      if (obj?.pet?.PetStats) {
        this.latestStats = obj.pet.PetStats;
        console.log(`📊 Stats update:`, this.latestStats);
      }
      if (obj?.error) console.warn(`[main] server error:`, obj.error);
    } catch {}
  }

  _onClose() {
    this._clearTimers();
    console.warn(`🔒 [main] socket closed, reconnecting soon...`);
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

      if (this.latestStats) {
        const { hunger, health, hygiene, energy } = this.latestStats;
        let acted = false;

        if (Number(hunger) < 30) {
          console.log("🍽 hunger low → eat");
          this.ws.send(makeEatString());
          acted = true;
        } else if (Number(energy) < 30) {
          console.log("⚡ energy low → energizer");
          this.ws.send(makeEnergyString());
          acted = true;
        } else if (Number(hygiene) < 30) {
          console.log("🚿 hygiene low → bath");
          this.ws.send(makeBathString());
          acted = true;
        } else if (Number(health) < 30) {
          console.log("❤️ health low → health item");
          this.ws.send(makeHealthString());
          acted = true;
        } else if (Number(hunger) >= 30 && Number(energy) >= 30 && Number(health) >= 30) {
          console.log("🎾 stats good → play");
          this.ws.send(makePlayString());
          acted = true;
        }

        if (acted) await sleep(INTER_MESSAGE_DELAY_MS);
      } else {
        // no stats yet, wait a little
        await sleep(500);
      }
    }
  }
}

(async () => {
  const runner = new RobustSocket();
  await runner.start();
})();
