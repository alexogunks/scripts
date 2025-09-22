// save as script.js -> node script.js
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

/** CONFIG **/
const ENDPOINT = "wss://petbot-monorepo-websocket-333713154917.europe-west1.run.app/";
const ORIGIN = "https://app.pett.ai";
const JWT = "Bearer eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlU3bU9NMzBNZGJRY3RQMmdoWE4wU0dhTDFIWjNSUWVoZWxkZUNHNF9OaWsifQ.eyJzaWQiOiJjbWZyaDJ3bWkwMDFubDIwZGFvc2YxYzFwIiwiaXNzIjoicHJpdnkuaW8iLCJpYXQiOjE3NTgzNjcwMTksImF1ZCI6ImNtN2dldjVzNjAwdmJrMmxzajZlMWU5ZzciLCJzdWIiOiJkaWQ6cHJpdnk6Y21lMGx0N25mMDA5MWpsMGJ6b2tybDB4aiIsImV4cCI6MTc1ODM3MDYxOX0.o7eEvh8rixfNcdF3bbdeHeJ-jnPxKb4QfIpWzOTDUTcVxw2MsC9NUSU7F4sGKqRrO5BlTBNswQe7tpHSM1zbeQ"

// pick mode
const type = "5-socket"; // "5-socket" | "1-socket"

const INTER_MESSAGE_DELAY_MS = 500;
const HEARTBEAT_PING_MS = 5000;
const AUTH_REFRESH_MS = 500;   // re-auth every 15s
const CONNECT_TIMEOUT_MS = 3000; // fail & retry if not open in 3s
const RECONNECT_DELAY_MS = 3000; // wait before retry if closed
const HEALTH_INTERVAL_SECONDS = 2000;
const ENERGY_INTERVAL_SECONDS = 5000;

const FOOD_TYPE = 'COOKIE' // salad | cookie

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
const makeEatString    = () => JSON.stringify({ type: "CONSUMABLES_USE", data: { params: { foodId: FOOD_TYPE } }, nonce: nonce() });
const makeHealthString = () => JSON.stringify({ type: "CONSUMABLES_USE", data: { params: { foodId: FOOD_TYPE === 'SALAD' ? FOOD_TYPE : "LARGE_POTION" } }, nonce: nonce() });

/** RobustSocket **/
class RobustSocket {
  constructor(actionType = null, smart = false) {
    this.actionType = actionType;
    this.smart = smart;
    this.ws = null;
    this.isAlive = false;
    this.heartbeatTimer = null;
    this.authTimer = null;
    this.healthTimer = null;
    this.energyTimer = null;
    this.connectTimer = null;
    this.stopped = false;
    this.lastStats = null;
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
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.authTimer) clearInterval(this.authTimer);
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.energyTimer) clearInterval(this.energyTimer);
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.heartbeatTimer = this.authTimer = this.connectTimer = this.healthTimer = this.energyTimer = null;
  }

  async _connect() {
    if (this.stopped) return;
    const headers = { Origin: ORIGIN, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

    console.log(`[${this.actionType || "smart"}] connecting...`);
    this.ws = new WebSocket(ENDPOINT, { headers, perMessageDeflate: false });

    // if not open in CONNECT_TIMEOUT_MS → close & retry
    this.connectTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
        console.warn(`[${this.actionType}] connect timeout → retrying`);
        try { this.ws.terminate(); } catch {}
        this._scheduleReconnect(0); // immediate retry
      }
    }, CONNECT_TIMEOUT_MS);

    this.ws.on("open", async () => await this._onOpen());
    this.ws.on("message", (m) => this._onMessage(m));
    this.ws.on("pong", () => { this.isAlive = true; });
    this.ws.on("close", () => this._onClose());
    this.ws.on("error", (err) => console.error(`[${this.actionType}] error:`, err?.message || err));
  }

  async _onOpen() {
    clearTimeout(this.connectTimer);
    console.log(`✅ [${this.actionType || "smart"}] socket open`);
    
    await this._safeSend(makeAuthString());  // <== use safeSend instead of raw send
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

    // refresh auth every 15s
    this.authTimer = setInterval(() => {
      this._safeSend(makeAuthString());
    }, AUTH_REFRESH_MS);

    this.healthTimer = setInterval(() => {
      this._safeSend(makeHealthString());
    }, HEALTH_INTERVAL_SECONDS);

    this.energyTimer = setInterval(() => {
      this._safeSend(makeEnergyString());
    }, ENERGY_INTERVAL_SECONDS);


    this._runLoop().catch(e => console.error(`[${this.actionType}] loop stopped:`, e?.message));
  }

  async _safeSend(payload) {
    let tries = 0;
    while (this.ws && this.ws.readyState !== WebSocket.OPEN && tries < 10) {
      await sleep(100);
      tries++;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      console.warn(`[${this.actionType}] skipped send — socket not open`);
    }
  }


  _sendAuth() { this.ws?.send(makeAuthString()); }

  _onMessage(raw) {
    try {
      const obj = JSON.parse(raw.toString());
      if (obj.type === "auth_result" && obj.pet?.PetStats) {
        this.lastStats = obj.pet.PetStats;
        // console.log(obj?.pet.PetStats)
        console.log(`[${this.actionType || "smart"}] stats`, JSON.stringify(this.lastStats));
      }
      if (obj?.error) console.warn(`[${this.actionType}] server error:`, obj.error);
    } catch {}
  }

  _onClose() {
    this._clearTimers();
    console.warn(`🔒 [${this.actionType}] socket closed, reconnecting...`);
    if (!this.stopped) this._scheduleReconnect(RECONNECT_DELAY_MS);
  }

  _scheduleReconnect(delayMs) {
    if (this.stopped) return;
    setTimeout(() => this._connect(), delayMs);
  }

  async _runLoop() {
    while (!this.stopped) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await sleep(500);
        continue;
      }

      if (this.smart) {
        const s = this.lastStats;
        if (s) {
          const hunger = Math.floor(parseFloat(s.hunger));
          const energy = Math.floor(parseFloat(s.energy));
          const health = Math.floor(parseFloat(s.health));
          const hygiene = Math.floor(parseFloat(s.hygiene));

          if (hunger < 25) {
            this.ws.send(makeEatString());
        //   } else if (energy < 20 && health < 70) {
        //     this.ws.send(makeHealthString());
        //     await sleep(1000);
        //     energy < 15 && this.ws.send(makeEnergyString());
        //   } else if (energy < 20 && health >= 50) {
        //     this.ws.send(makeHealthString());
        //     await sleep(1000);
        //     this.ws.send(makeAuthString());
        //     await sleep(3000)
        //     energy < 20 && this.ws.send(makeEnergyString());
          } else if (health < 70) {
            this.ws.send(makeHealthString());
          } else if (hygiene < 70) {
            this.ws.send(makeBathString());
          } else {
            this.ws.send(makePlayString());
            this.ws.send(makePlayString());
            this.ws.send(makePlayString());
            this.ws.send(makePlayString());
            this.ws.send(makePlayString());
            this.ws.send(makePlayString());
          }
        }
      } else {
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
