// Test client HTML served from the Worker at `/`.
// Two modes: "Viewer" (sends slide_change) and "Owner Dashboard" (subscribes to broadcasts).
// Computes a canvas + WebGL fingerprint client-side to validate the dedup primitive.

export const CLIENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Amaroad DO Presence PoC</title>
  <style>
    :root {
      --ink: #02001A;
      --accent: #009776;
      --accent-hover: #007960;
      --bg: #F0F2F5;
      --surface: #FFFFFF;
      --border: #E5E7EB;
      --text-muted: #6B7280;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--ink);
    }
    h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: -0.01em; }
    h1 .accent { color: var(--accent); }
    h2 { margin: 0 0 12px; font-size: 18px; }
    .tagline { color: var(--text-muted); margin: 0 0 24px; font-size: 14px; }
    button {
      background: var(--accent);
      color: white;
      padding: 10px 18px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      margin-right: 8px;
    }
    button:hover { background: var(--accent-hover); }
    button:disabled { background: var(--text-muted); cursor: not-allowed; }
    button.secondary {
      background: var(--surface);
      color: var(--ink);
      border: 1px solid var(--border);
    }
    button.secondary:hover { background: var(--bg); }
    code {
      font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
      background: var(--surface);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      border: 1px solid var(--border);
    }
    .panel {
      background: var(--surface);
      padding: 20px;
      border-radius: 12px;
      margin: 16px 0;
      border: 1px solid var(--border);
    }
    .mode { display: none; }
    .mode.active { display: block; }
    .viewer-card {
      background: var(--bg);
      padding: 14px 16px;
      margin: 10px 0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .viewer-card .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 3px rgba(0, 151, 118, 0.2);
    }
    .viewer-card .id { font-family: monospace; font-size: 13px; }
    .viewer-card .slide { margin-left: auto; font-weight: 600; color: var(--accent); }
    #log {
      background: #1a1c24;
      color: #d1d5db;
      padding: 14px;
      height: 240px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 12px;
      border-radius: 8px;
      line-height: 1.6;
    }
    #log .in { color: #9ca3af; }
    #log .out { color: #009776; }
    #log .err { color: #f87171; }
    .kv { display: flex; gap: 6px; margin: 6px 0; font-size: 14px; }
    .kv .k { color: var(--text-muted); min-width: 96px; }
    .slide-display {
      margin: 16px 0;
      padding: 28px;
      background: var(--bg);
      border-radius: 8px;
      text-align: center;
    }
    .slide-display .num { font-size: 48px; font-weight: 700; color: var(--accent); }
    .slide-display .total { color: var(--text-muted); font-size: 18px; }
  </style>
</head>
<body>
  <h1>Amaroad <span class="accent">DO Presence PoC</span></h1>
  <p class="tagline">Open this page in multiple tabs — one as Owner, rest as Viewers — to validate realtime presence.</p>

  <div class="panel" id="lobby">
    <h2>Choose a role</h2>
    <button onclick="joinAs('viewer')">Join as Viewer</button>
    <button onclick="joinAs('owner')">Join as Owner Dashboard</button>
  </div>

  <div class="panel mode" id="viewer-mode">
    <h2>Viewer</h2>
    <div class="kv"><span class="k">Session ID:</span> <code id="v-session-id"></code></div>
    <div class="kv"><span class="k">Fingerprint:</span> <code id="v-fp"></code></div>
    <div class="slide-display">
      <div class="num"><span id="v-slide-num">1</span><span class="total"> / 20</span></div>
    </div>
    <button onclick="prevSlide()">← Previous</button>
    <button onclick="nextSlide()">Next →</button>
    <button class="secondary" onclick="disconnect()">Disconnect</button>
  </div>

  <div class="panel mode" id="owner-mode">
    <h2>Owner Dashboard</h2>
    <div class="kv"><span class="k">Deck ID:</span> <code>test-deck</code></div>
    <div id="viewers">
      <p style="color: var(--text-muted);">Waiting for viewers...</p>
    </div>
    <button class="secondary" onclick="disconnect()">Disconnect</button>
  </div>

  <div class="panel">
    <h2>Live log</h2>
    <div id="log"></div>
  </div>

  <script>
    let ws = null;
    let role = null;
    let sessionId = crypto.randomUUID();
    let currentSlide = 0;
    let heartbeatTimer = null;
    const viewers = new Map();

    function logLine(kind, text) {
      const el = document.getElementById("log");
      const line = document.createElement("div");
      line.className = kind;
      line.textContent = new Date().toTimeString().slice(0, 8) + " " + text;
      el.appendChild(line);
      el.scrollTop = el.scrollHeight;
    }

    async function computeFingerprint() {
      const canvas = document.createElement("canvas");
      canvas.width = 280;
      canvas.height = 60;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "nocanvas";
      ctx.textBaseline = "top";
      ctx.font = '14px "Arial"';
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("Amaroad fp v1", 2, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("Amaroad fp v1", 4, 17);

      let webglInfo = "";
      try {
        const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        if (gl) {
          const dbg = gl.getExtension("WEBGL_debug_renderer_info");
          if (dbg) {
            webglInfo = [
              gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
              gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL),
            ].join("|");
          }
        }
      } catch {}

      const raw = canvas.toDataURL() + "::" + webglInfo + "::" + navigator.userAgent;
      const hashBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(hashBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
    }

    async function joinAs(r) {
      stopHeartbeat();
      if (ws) {
        ws.close(1000, "switch role");
      }

      role = r;
      const fp = await computeFingerprint();

      document.querySelectorAll(".mode").forEach((el) => el.classList.remove("active"));
      document.getElementById(r + "-mode").classList.add("active");
      document.getElementById("lobby").style.display = "none";

      if (r === "viewer") {
        document.getElementById("v-session-id").textContent = sessionId.slice(0, 12);
        document.getElementById("v-fp").textContent = fp;
      }

      const proto = location.protocol === "https:" ? "wss" : "ws";
      const wsUrl =
        proto + "://" + location.host + "/ws?role=" + r + "&sessionId=" + sessionId + "&fp=" + fp + "&deckId=test-deck";

      logLine("in", "connecting to " + wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logLine("out", "connected as " + r);
        if (r === "viewer") {
          heartbeatTimer = window.setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "heartbeat" }));
            }
          }, 15000);
        }
      };
      ws.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch {
          logLine("err", "malformed message: " + e.data);
          return;
        }
        logLine("in", "recv " + msg.type);
        handleServerMessage(msg);
      };
      ws.onclose = (e) => {
        stopHeartbeat();
        ws = null;
        logLine("err", "disconnected: " + e.code + " " + (e.reason || ""));
      };
      ws.onerror = () => {
        stopHeartbeat();
        logLine("err", "ws error");
      };
    }

    function handleServerMessage(msg) {
      if (msg.type === "snapshot") {
        viewers.clear();
        msg.viewers.forEach((v) => viewers.set(v.sessionId, v));
        renderViewers();
      } else if (msg.type === "viewer.joined") {
        viewers.set(msg.sessionId, {
          sessionId: msg.sessionId,
          fingerprint: msg.fingerprint,
          currentSlide: msg.currentSlide,
          joinedAt: msg.joinedAt,
        });
        renderViewers();
      } else if (msg.type === "viewer.slide_changed") {
        const v = viewers.get(msg.sessionId);
        if (v) {
          v.currentSlide = msg.slideIndex;
          renderViewers();
        }
      } else if (msg.type === "viewer.left") {
        viewers.delete(msg.sessionId);
        renderViewers();
      }
    }

    function nextSlide() {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      currentSlide++;
      document.getElementById("v-slide-num").textContent = currentSlide + 1;
      ws.send(JSON.stringify({ type: "slide_change", slideIndex: currentSlide }));
      logLine("out", "slide_change → " + (currentSlide + 1));
    }

    function prevSlide() {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      currentSlide = Math.max(0, currentSlide - 1);
      document.getElementById("v-slide-num").textContent = currentSlide + 1;
      ws.send(JSON.stringify({ type: "slide_change", slideIndex: currentSlide }));
      logLine("out", "slide_change → " + (currentSlide + 1));
    }

    function disconnect() {
      stopHeartbeat();
      if (ws) ws.close(1000, "user disconnect");
    }

    function renderViewers() {
      const el = document.getElementById("viewers");
      if (viewers.size === 0) {
        const empty = document.createElement("p");
        empty.style.color = "var(--text-muted)";
        empty.textContent = "Waiting for viewers...";
        el.replaceChildren(empty);
        return;
      }
      el.replaceChildren();
      viewers.forEach((v) => {
        const card = document.createElement("div");
        card.className = "viewer-card";

        const dot = document.createElement("span");
        dot.className = "dot";

        const id = document.createElement("span");
        id.className = "id";
        id.textContent = v.sessionId.slice(0, 12);

        const fp = document.createElement("span");
        fp.className = "id";
        fp.style.color = "var(--text-muted)";
        fp.textContent = "fp " + v.fingerprint.slice(0, 10);

        const slide = document.createElement("span");
        slide.className = "slide";
        slide.textContent = "Slide " + (v.currentSlide + 1);

        card.append(dot, id, fp, slide);
        el.appendChild(card);
      });
    }

    function stopHeartbeat() {
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }
  </script>
</body>
</html>`;
