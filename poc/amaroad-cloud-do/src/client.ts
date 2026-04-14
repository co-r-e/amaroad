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
      --danger: #DC2626;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      margin: 0;
      background: var(--bg);
      color: var(--ink);
    }
    .app {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    aside.sidebar {
      width: 256px;
      flex-shrink: 0;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: sticky;
      top: 0;
      height: 100vh;
    }
    .sidebar-header {
      padding: 20px 20px 16px;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-header h1 {
      margin: 0;
      font-size: 18px;
      letter-spacing: -0.01em;
    }
    .sidebar-header h1 .accent { color: var(--accent); }
    .sidebar-header p {
      margin: 4px 0 0;
      color: var(--text-muted);
      font-size: 12px;
    }
    .sidebar-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 12px;
    }
    .sidebar-section { margin-bottom: 20px; }
    .sidebar-section .label {
      margin: 0 8px 8px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .sidebar-section .rows {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .nav-btn {
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      padding: 9px 12px;
      border-radius: 8px;
      cursor: pointer;
      color: var(--ink);
      font-size: 14px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
    }
    .nav-btn:hover { background: var(--bg); }
    .nav-btn.active {
      background: var(--ink);
      color: white;
    }
    .nav-btn .icon {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
      flex-shrink: 0;
    }
    .nav-btn.active .icon { background: var(--accent); }
    .info-card {
      margin: 0 8px;
      background: var(--bg);
      border-radius: 8px;
      padding: 10px 12px;
    }
    .info-card .row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .info-card .row + .row { margin-top: 8px; }
    .info-card .k {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .info-card .v {
      font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      color: var(--ink);
      word-break: break-all;
    }
    .sidebar-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .conn-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .conn-pill .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
    }
    .conn-pill.connected .dot { background: var(--accent); box-shadow: 0 0 0 3px rgba(0, 151, 118, 0.2); }
    .conn-pill.error .dot { background: var(--danger); }
    .disconnect-btn {
      background: var(--surface);
      color: var(--ink);
      border: 1px solid var(--border);
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    }
    .disconnect-btn:hover { background: var(--bg); }
    .disconnect-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Main content */
    main.main {
      flex: 1;
      min-width: 0;
      padding: 24px 32px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .main-header h2 { margin: 0 0 4px; font-size: 22px; letter-spacing: -0.01em; }
    .main-header p { margin: 0; color: var(--text-muted); font-size: 13px; }
    .panel {
      background: var(--surface);
      padding: 20px;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .panel + .panel { margin-top: 0; }
    .panel h3 { margin: 0 0 12px; font-size: 15px; }
    .mode { display: none; }
    .mode.active { display: flex; flex-direction: column; gap: 16px; }
    button.primary {
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
    button.primary:hover { background: var(--accent-hover); }
    button.primary:disabled { background: var(--text-muted); cursor: not-allowed; }
    code {
      font-family: "SFMono-Regular", Menlo, Monaco, Consolas, monospace;
      background: var(--bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      border: 1px solid var(--border);
    }
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
      height: 220px;
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
  <div class="app">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>Amaroad <span class="accent">DO PoC</span></h1>
        <p>Durable Object presence</p>
      </div>

      <div class="sidebar-body">
        <div class="sidebar-section">
          <p class="label">Role</p>
          <div class="rows">
            <button id="btn-lobby" class="nav-btn active" onclick="showLobby()">
              <span class="icon"></span>
              Lobby
            </button>
            <button id="btn-viewer" class="nav-btn" onclick="joinAs('viewer')">
              <span class="icon"></span>
              Viewer
            </button>
            <button id="btn-owner" class="nav-btn" onclick="joinAs('owner')">
              <span class="icon"></span>
              Owner Dashboard
            </button>
          </div>
        </div>

        <div class="sidebar-section" id="session-info" style="display: none">
          <p class="label">Session</p>
          <div class="info-card">
            <div class="row">
              <span class="k">Session ID</span>
              <span class="v" id="v-session-id"></span>
            </div>
            <div class="row">
              <span class="k">Fingerprint</span>
              <span class="v" id="v-fp"></span>
            </div>
            <div class="row">
              <span class="k">Deck ID</span>
              <span class="v">test-deck</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="conn-pill" id="conn-status">
          <span class="dot"></span>
          <span class="text">Disconnected</span>
        </div>
        <button class="disconnect-btn" id="btn-disconnect" onclick="disconnect()" disabled>
          Disconnect
        </button>
      </div>
    </aside>

    <main class="main">
      <div class="main-header">
        <h2 id="header-title">Lobby</h2>
        <p id="header-subtitle">Select a role from the sidebar to begin.</p>
      </div>

      <div class="mode active" id="lobby">
        <div class="panel">
          <h3>Getting started</h3>
          <p style="margin: 0 0 10px; font-size: 14px; line-height: 1.6;">
            Open this page in multiple tabs — one as <strong>Owner Dashboard</strong>, the others as <strong>Viewer</strong> — to validate realtime presence via the Durable Object Hibernation API.
          </p>
          <p style="margin: 0; font-size: 13px; color: var(--text-muted);">
            This is a development PoC. In production, owner and viewer are completely separate UIs on <code>app.amaroad.com</code> and <code>v.amaroad.com</code>.
          </p>
        </div>
      </div>

      <div class="mode" id="viewer-mode">
        <div class="panel">
          <h3>Viewer</h3>
          <div class="slide-display">
            <div class="num"><span id="v-slide-num">1</span><span class="total"> / 20</span></div>
          </div>
          <button class="primary" onclick="prevSlide()">← Previous</button>
          <button class="primary" onclick="nextSlide()">Next →</button>
        </div>
      </div>

      <div class="mode" id="owner-mode">
        <div class="panel">
          <h3>Owner Dashboard</h3>
          <div id="viewers">
            <p style="color: var(--text-muted);">Waiting for viewers...</p>
          </div>
        </div>
      </div>

      <div class="panel">
        <h3>Live log</h3>
        <div id="log"></div>
      </div>
    </main>
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

    function setConnStatus(state) {
      const el = document.getElementById("conn-status");
      const text = el.querySelector(".text");
      el.classList.remove("connected", "error");
      if (state === "connected") {
        el.classList.add("connected");
        text.textContent = "Connected";
      } else if (state === "error") {
        el.classList.add("error");
        text.textContent = "Error";
      } else {
        text.textContent = "Disconnected";
      }
    }

    function setActiveNav(id) {
      document.querySelectorAll(".nav-btn").forEach((el) => el.classList.remove("active"));
      const btn = document.getElementById(id);
      if (btn) btn.classList.add("active");
    }

    function setMainHeader(title, subtitle) {
      document.getElementById("header-title").textContent = title;
      document.getElementById("header-subtitle").textContent = subtitle;
    }

    function showLobby() {
      stopHeartbeat();
      if (ws) ws.close(1000, "back to lobby");
      role = null;
      document.querySelectorAll(".mode").forEach((el) => el.classList.remove("active"));
      document.getElementById("lobby").classList.add("active");
      document.getElementById("session-info").style.display = "none";
      document.getElementById("btn-disconnect").disabled = true;
      setActiveNav("btn-lobby");
      setMainHeader("Lobby", "Select a role from the sidebar to begin.");
      setConnStatus("disconnected");
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
      setActiveNav("btn-" + r);

      if (r === "viewer") {
        setMainHeader("Viewer", "You are viewing the deck. Use Previous/Next to advance slides.");
      } else {
        setMainHeader("Owner Dashboard", "Realtime presence of all connected viewers.");
      }

      document.getElementById("v-session-id").textContent = sessionId.slice(0, 24);
      document.getElementById("v-fp").textContent = fp;
      document.getElementById("session-info").style.display = "block";
      document.getElementById("btn-disconnect").disabled = false;

      const proto = location.protocol === "https:" ? "wss" : "ws";
      const wsUrl =
        proto + "://" + location.host + "/ws?role=" + r + "&sessionId=" + sessionId + "&fp=" + fp + "&deckId=test-deck";

      logLine("in", "connecting to " + wsUrl);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logLine("out", "connected as " + r);
        setConnStatus("connected");
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
        setConnStatus("disconnected");
        logLine("err", "disconnected: " + e.code + " " + (e.reason || ""));
      };
      ws.onerror = () => {
        stopHeartbeat();
        setConnStatus("error");
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
      showLobby();
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
