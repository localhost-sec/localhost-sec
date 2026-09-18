const mineflayer = require("mineflayer");
const express = require("express");

const PORT = Number(process.env.PORT || 10000);
const MC_HOST = process.env.MC_HOST;
const MC_PORT = Number(process.env.MC_PORT || 25565);
const MC_USERNAME = process.env.MC_USERNAME || "ServerAFK";
const MC_VERSION = process.env.MC_VERSION || false;
const MC_AUTH = process.env.MC_AUTH || "offline";

const RECONNECT_MIN = Number(process.env.RECONNECT_MIN_SECONDS || 10);
const RECONNECT_MAX = Number(process.env.RECONNECT_MAX_SECONDS || 30);
const ACTIVITY_ENABLED = (process.env.ACTIVITY_ENABLED || "false").toLowerCase() === "true";
const ACTIVITY_MIN = Number(process.env.ACTIVITY_MIN_SECONDS || 45);
const ACTIVITY_MAX = Number(process.env.ACTIVITY_MAX_SECONDS || 120);

if (!MC_HOST) {
  console.error("[CONFIG] MC_HOST is required.");
  process.exit(1);
}

const app = express();

let bot = null;
let state = "starting";
let lastConnectedAt = null;
let reconnectTimer = null;
let activityTimer = null;

app.get("/", (_req, res) => {
  res.json({
    service: "minecraft-afk-bot",
    state,
    minecraft: {
      host: MC_HOST,
      port: MC_PORT,
      username: MC_USERNAME
    },
    lastConnectedAt
  });
});

app.get("/health", (_req, res) => {
  const healthy = state === "connected";
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "starting",
    state
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[HTTP] Health server listening on :${PORT}`);
});

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clearActivityTimer() {
  if (activityTimer) {
    clearTimeout(activityTimer);
    activityTimer = null;
  }
}

function scheduleActivity() {
  clearActivityTimer();

  if (!ACTIVITY_ENABLED || !bot || !bot.entity) {
    return;
  }

  const delay = randomInt(ACTIVITY_MIN, ACTIVITY_MAX) * 1000;

  activityTimer = setTimeout(() => {
    if (!bot || !bot.entity || state !== "connected") {
      return;
    }

    try {
      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * 0.35;
      bot.look(yaw, pitch, true);

      // Optional short movement. Keep disabled unless your server requires
      // actual movement to avoid AFK kicks.
      if (Math.random() < 0.35) {
        bot.setControlState("forward", true);
        setTimeout(() => {
          if (bot) bot.setControlState("forward", false);
        }, randomInt(400, 1200));
      }

      console.log("[ACTIVITY] Sent periodic AFK activity.");
    } catch (err) {
      console.error("[ACTIVITY]", err.message);
    }

    scheduleActivity();
  }, delay);
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  const delay = randomInt(RECONNECT_MIN, RECONNECT_MAX) * 1000;
  console.log(`[RECONNECT] Retrying in ${Math.round(delay / 1000)}s...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function cleanupBot() {
  clearActivityTimer();

  if (bot) {
    try {
      bot.removeAllListeners();
      bot.quit("reconnecting");
    } catch (_) {
      // Ignore cleanup errors.
    }
  }

  bot = null;
}

function connect() {
  cleanupBot();
  state = "connecting";

  console.log(`[MC] Connecting to ${MC_HOST}:${MC_PORT} as ${MC_USERNAME}...`);

  const options = {
    host: MC_HOST,
    port: MC_PORT,
    username: MC_USERNAME,
    auth: MC_AUTH
  };

  if (MC_VERSION) {
    options.version = MC_VERSION;
  }

  bot = mineflayer.createBot(options);

  bot.once("login", () => {
    state = "connected";
    lastConnectedAt = new Date().toISOString();
    console.log("[MC] Login successful.");
    scheduleActivity();
  });

  bot.once("spawn", () => {
    console.log("[MC] Spawned in the world.");
    scheduleActivity();
  });

  bot.on("kicked", (reason) => {
    console.warn("[MC] Kicked:", reason);
    state = "disconnected";
  });

  bot.on("end", () => {
    console.warn("[MC] Connection ended.");
    state = "disconnected";
    cleanupBot();
    scheduleReconnect();
  });

  bot.on("error", (err) => {
    console.error("[MC] Error:", err.message);
    state = "error";
  });

  bot.on("death", () => {
    console.log("[MC] Bot died; waiting for respawn.");
    setTimeout(() => {
      if (bot && bot.entity) {
        try {
          bot.emit("respawn");
        } catch (_) {
          // Some server implementations handle respawn automatically.
        }
      }
    }, 1000);
  });
}

process.on("SIGTERM", () => {
  console.log("[SYSTEM] SIGTERM received.");
  state = "stopping";
  clearActivityTimer();
  if (bot) {
    try { bot.quit("service stopping"); } catch (_) {}
  }
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[SYSTEM] SIGINT received.");
  state = "stopping";
  clearActivityTimer();
  if (bot) {
    try { bot.quit("service stopping"); } catch (_) {}
  }
  process.exit(0);
});

connect();
