# Minecraft AFK Bot

A lightweight Mineflayer client that keeps a Minecraft login connected and automatically reconnects after disconnects.

## Render

This repository is configured as a **Render Web Service** because Render's current Free compute supports Web Services, while free Background Workers are not available. The bot exposes `/health` and `/` so the service can be monitored.

Render's Free Web Services can spin down after 15 minutes without incoming traffic. If you need the bot continuously available on the Free plan, configure an external HTTP monitor to request:

`https://YOUR-RENDER-SERVICE.onrender.com/health`

about every 10–14 minutes. Render's free tier also has a monthly instance-hour limit, so 24/7 use can exhaust that allowance before the end of a month.

## Deploy

1. In Render, choose **New → Web Service** and connect this repository.
2. Set the service root directory to `minecraft-afk-bot`.
3. Build command: `npm install`
4. Start command: `npm start`
5. Choose the **Free** plan if available.
6. Set the environment variables from `.env.example`.

## Minecraft authentication

### Offline-mode server

Use:

```
MC_AUTH=offline
MC_USERNAME=ServerAFK
```

### Online-mode server

Use a dedicated Microsoft/Minecraft account:

```
MC_AUTH=microsoft
MC_USERNAME=bot-account@example.com
```

Mineflayer may request Microsoft device-code authentication during the first login. Authentication state on a Free Render service should not be treated as durable storage, so a restart/redeploy may require authentication again.

## AFK activity

For a server that only needs a connected player, leave:

```
ACTIVITY_ENABLED=false
```

If the server has an AFK-kick plugin, you can enable:

```
ACTIVITY_ENABLED=true
```

The bot then periodically changes its view and occasionally takes a very short forward step.

## Local run

```bash
npm install
cp .env.example .env
# edit .env
npm start
```

The HTTP server listens on `PORT` and the Minecraft bot connects immediately.

## Endpoints

- `GET /` – JSON status
- `GET /health` – health check (HTTP 200 when connected)

## Notes

This bot is a client connection. It does not create a Bukkit/Spigot player object and it must run in a process outside the Minecraft server itself.
