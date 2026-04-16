// ==UserScript==
// @name         Discogs Price Helper Pro
// @namespace    http://tampermonkey.net/
// @version      2.2.3
// @description  Discogs price viewer (Mercari / Yahoo / eBay) — scrollable UI for large results
// @match        https://jp.mercari.com/*
// @match        *://auctions.yahoo.co.jp/jp/auction/*
// @match        *://www.ebay.com/itm/*
// @grant        GM.xmlHttpRequest
// @connect      *
// ==/UserScript==

(function () {
  "use strict";

  const CONFIG = {
    API_BASE: "http://204.168.135.35:3000",
    API_BASE2: "http://204.168.135.35:3500",
    APP_BASE: "http://204.168.135.35:4173",
    EMAIL: "test@example.com",
    PASSWORD: "password123",
    GEMINI: "/api/v1/gemini",
    DISCOGS: "/api/v1/discogsData",
    JOB: "/api/scrape",
    AUTH_ME: "/auth/me",
    AUTH_LOGIN: "/auth/login",
    AUTH_REFRESH: "/auth/refresh",
    ACCESS_TOKEN: "kX9%^mZ7GYd7dduV^m&t5wX9s8Z5n",
    POLL_INTERVAL: 2500,
  };

  const AUTH_STORAGE_KEY = "digmap_auth_session";

  let running = false;
  let collapsed = false;
  let lastUrl = location.href;
  let authChecked = false;
  let isAuthenticated = false;
  let latestReleases = [];
  let page = null;
  const id = crypto.randomUUID();
  init();
  observeUrl();

  function observeUrl() {
    const obs = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        running = false;
        authChecked = false;
        isAuthenticated = false;
        latestReleases = [];
        removeUI();
        if (isTargetPage()) {
          location.reload();
        }
        init();
      }
    });
    obs.observe(document, { subtree: true, childList: true });
  }

  async function init() {
    // alert("1");
    if (running) return;
    if (!isTargetPage()) return;
    // alert("2");

    await waitTitle();

    page = extractPage();
    if (!page.title) return;
    // alert("3");

    running = true;
    showLoading();

    try {
      await ensureAuthChecked();

      const meta = await gemini(page);
      const releases = await searchDiscogs(meta);
      latestReleases = releases;

      if (!releases.length) {
        showError("Discogs候補なし");
        return;
      }

      renderResults(releases);

      const ids = releases.map((r) => r.id.toString());

      pollJob(updatePrices);
      const res = await createJob(id, ids);
      for (const s of res) {
        const el = document.querySelector(`[data-id="${s.resourceId}"]`);
        if (!el) continue;
        el.querySelector(".low").innerText = s.lowest ?? "N/A";
        el.querySelector(".med").innerText = s.median ?? "N/A";
        el.querySelector(".high").innerText = s.highest ?? "N/A";
      }
    } catch (e) {
      console.error(e);
      showError(e?.message ?? String(e));
    }
  }

  function isTargetPage() {
    const u = location.href;
    return (
      u.includes("mercari.com/item") ||
      u.includes("auctions.yahoo.co.jp") ||
      u.includes("ebay.com/itm")
    );
  }

  function waitTitle() {
    return new Promise((res) => {
      let t = 0;
      const i = setInterval(() => {
        const h = document.querySelector("h1");
        if (h?.innerText) {
          clearInterval(i);
          res();
        }
        if (t++ > 50) {
          clearInterval(i);
          res();
        }
      }, 200);
    });
  }

  function extractPage() {
    const title = document.querySelector("h1")?.innerText || document.title;
    let desc = "";
    let price = "";
    if (location.href.includes("mercari")) {
      desc =
        document.querySelector('[data-testid="description"]')?.innerText || "";
      price =
        document
          .querySelector('[data-testid="price"]')
          .querySelector("span:nth-of-type(2)")
          ?.innerText.replace(/[^0-9]/g, "") || "";
    }
    if (location.href.includes("yahoo")) {
      desc = document.querySelector("#description")?.innerText || "";
      price =
        document
          .querySelector(".sc-1f0603b0-2")
          ?.innerText.replace(/[^0-9]/g, "") || "";
      if (price == "") {
        price =
          document
            .querySelector(".sc-707a05cc-3")
            ?.innerText.replace(/[^0-9]/g, "") || "";
      }
    }
    if (location.href.includes("ebay")) {
      desc =
        document.querySelector("#viTabs_0_is")?.innerText ||
        document.querySelector("#itemDescription")?.innerText ||
        "";
      price = document.querySelector(".x-price-approx__price");
      if (price) {
        price =
          price.querySelector("span")?.innerText.replace(/[^0-9]/g, "") || "";
      } else {
        price =
          document
            .querySelector(".x-price-primary")
            .querySelector("span")
            ?.innerText.replace(/[^0-9]/g, "") || "";
      }
    }
    return { title, description: desc, price };
  }

  async function ensureAuthChecked() {
    if (authChecked) return;
    authChecked = true;
    try {
      let result = null;
      if (!getStoredSession()) {
        await login();
      }
      result = await apiRequest("GET", CONFIG.AUTH_ME);
      if (result) {
        isAuthenticated = true;
      } else {
        setStoredSession(null);
        await login();
        result = await apiRequest("GET", CONFIG.AUTH_ME);
        if (!result) {
          isAuthenticated = false;
        } else {
          isAuthenticated = true;
        }
      }
    } catch (e) {
      isAuthenticated = false;
      console.warn("[auth/me] failed", e);
    }
  }

  async function gemini(data) {
    const r = await request(CONFIG.API_BASE + CONFIG.GEMINI, "POST", {
      accessToken: CONFIG.ACCESS_TOKEN,
      ...data,
    });
    return r.result;
  }

  async function searchDiscogs(meta) {
    let q = [];
    if (meta?.catalog_number) q.push(meta.catalog_number);
    else {
      if (meta?.artist) q.push(meta.artist);
      if (meta?.title) q.push(meta.title);
    }

    const r = await request(
      "https://api.discogs.com/database/search",
      "GET",
      null,
      {
        q: q.join(" "),
      },
    );

    return (r.results || []).map((v) => ({
      id: v.id,
      title: v.title,
      format: v.format?.join(", "),
      year: v.year,
      lowest: null,
      median: null,
      highest: null,
    }));
  }

  async function createJob(jobId, ids) {
    const r = await request(CONFIG.API_BASE + CONFIG.DISCOGS, "POST", {
      resourceIds: ids,
      accessToken: CONFIG.ACCESS_TOKEN,
      jobId,
    });
    return r;
  }

  function pollJob(onUpdate) {
    const t = setInterval(async () => {
      try {
        const job = await request(
          `${CONFIG.API_BASE}${CONFIG.JOB}/${id}`,
          "POST",
          {
            accessToken: CONFIG.ACCESS_TOKEN,
          },
        );

        if (job) onUpdate(job);

        if (job && job.successJobCount === job.penddingJobCount) {
          clearInterval(t);
        }
      } catch (err) {
        console.warn("[pollJob] error", err);
      }
    }, CONFIG.POLL_INTERVAL);
  }

  function updatePrices(job) {
    if (!job) return;
    const total = job.penddingJobCount || 0;
    const done = job.successJobCount || 0;

    const bar = document.querySelector("#discogs-progress");
    if (bar && total > 0) bar.style.width = (done / total) * 100 + "%";

    const status = document.querySelector("#discogs-status");
    if (status) status.innerText = `Fetching prices ${done}/${total}`;

    const badge = document.getElementById("discogs-badge");
    if (badge) {
      if (total > 0) {
        const pct = Math.round((done / total) * 100);
        badge.innerText = `${pct}%`;
        if (collapsed) badge.style.display = "inline-block";
      } else {
        badge.innerText = `0%`;
      }
    }

    updateMiniIndicator(done, total);

    if (total > 0 && done === total) {
      const statusDone = document.querySelector("#discogs-status");
      if (statusDone) statusDone.innerText = "Complete";
      const mini = document.getElementById("discogs-mini-indicator");
      if (mini) mini.querySelector("#discogs-mini-label").innerText = "Done";
    }
  }

  function showLoading() {
    removeUI();
    const box = createUI();
    document.body.prepend(box);
    createMiniIndicator();
  }

  function renderResults(data) {
    const box = document.getElementById("discogs-ui");
    if (!box) return;
    const list = box.querySelector("#discogs-list");
    box.querySelector("#discogs-status").innerText = "Searching Discogs...";
    list.innerHTML = data
      .map(
        (r) => `
<div class="discogs-card" data-id="${r.id}">
  <div class="discogs-title">${escapeHtml(r.title)}</div>
  <div class="discogs-meta">${escapeHtml(r.format || "")} ${r.year || ""}</div>
  <div class="discogs-price"><span>Lowest</span><span class="low">-</span></div>
  <div class="discogs-price"><span>Median</span><span class="med">-</span></div>
  <div class="discogs-price"><span>Highest</span><span class="high">-</span></div>
  <div class="discogs-actions">
    <a target="_blank" rel="noreferrer noopener" href="https://discogs.com/release/${r.id}" class="discogs-btn discogs-btn-secondary" style="color:#fff">Open Discogs</a>
    ${
      isAuthenticated
        ? `<button type="button" class="discogs-btn" data-release-id="${r.id}">Open Digmap</button>`
        : ""
    }
  </div>
</div>
`,
      )
      .join("");

    list.querySelectorAll("[data-release-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const releaseId = btn.getAttribute("data-release-id");
        openDigmap(releaseId);
      });
    });
  }

  function openDigmap(releaseId) {
    if (!releaseId) return;
    const url = `${CONFIG.APP_BASE}/app/my-lists?releaseId=${encodeURIComponent(
      releaseId,
    )}&url=${location.href}&price=${encodeURIComponent(page.price)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function createUI() {
    injectStyle();

    const box = document.createElement("div");
    box.id = "discogs-ui";

    box.innerHTML = `
<div class="discogs-head">
  <div style="display:flex;gap:8px;align-items:center">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style="opacity:.9"><path d="M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0z" stroke="#9be7ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12h8" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <strong>Discogs Analyzer</strong>
    <div class="discogs-mini-badge" id="discogs-badge" aria-hidden="true">0%</div>
  </div>
  <div id="discogs-toggle" title="Toggle">▾</div>
</div>

<div id="discogs-status" aria-live="polite">Analyzing...</div>

<div class="discogs-progress">
  <div id="discogs-progress"></div>
</div>

<div id="discogs-list" class="discogs-list" role="list"></div>
`;

    const toggleBtn = box.querySelector("#discogs-toggle");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", toggleUI);
    }
    box.querySelector("#discogs-badge")?.addEventListener("click", () => {
      if (collapsed) toggleUI();
    });

    return box;
  }

  function createMiniIndicator() {
    if (document.getElementById("discogs-mini-indicator")) return;
    const mini = document.createElement("div");
    mini.id = "discogs-mini-indicator";
    mini.innerHTML = `<div><strong id="discogs-mini-count">0/0</strong><small id="discogs-mini-label">Fetching</small></div>`;
    mini.addEventListener("click", () => {
      if (!document.getElementById("discogs-ui")) {
        const box = createUI();
        document.body.prepend(box);
      }
      const box = document.getElementById("discogs-ui");
      if (box) {
        box.style.display = "block";
        if (collapsed) toggleUI();
      }
    });
    document.body.appendChild(mini);
  }

  function updateMiniIndicator(done, total) {
    const mini = document.getElementById("discogs-mini-indicator");
    if (!mini) return;
    const cnt = mini.querySelector("#discogs-mini-count");
    const label = mini.querySelector("#discogs-mini-label");
    cnt.innerText = `${done}/${total}`;
    if (total > 0) {
      if (done === total) label.innerText = "Done";
      else label.innerText = "Fetching";
    } else {
      label.innerText = "Waiting";
    }
    mini.classList.remove("hidden");
  }

  function removeUI() {
    document.getElementById("discogs-ui")?.remove();
  }
  function toggleUI() {
    collapsed = !collapsed;

    const box = document.getElementById("discogs-ui");
    if (!box) return;

    const list = box.querySelector("#discogs-list");
    const progress = box.querySelector(".discogs-progress");
    const status = box.querySelector("#discogs-status");
    const btn = box.querySelector("#discogs-toggle");
    const badge = box.querySelector("#discogs-badge");

    if (collapsed) {
      list.style.display = "none";
      progress.style.display = "none";
      status.style.display = "none";
      if (badge) badge.style.display = "inline-block";

      btn.innerText = "▸";
    } else {
      list.style.display = "block";
      progress.style.display = "block";
      status.style.display = "block";
      if (badge) badge.style.display = "none";

      btn.innerText = "▾";
    }
  }
  function injectStyle() {
    if (document.getElementById("discogs-style")) return;

    const s = document.createElement("style");
    s.id = "discogs-style";
    s.innerHTML = `
#discogs-ui{
  position:fixed;
  top:80px;
  right:20px;
  width:360px;
  max-height:70vh;
  overflow:hidden;
  background:#111;
  color:#fff;
  padding:12px;
  border-radius:12px;
  font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  box-shadow:0 15px 40px rgba(0,0,0,.5);
  z-index:999999;
  box-sizing:border-box;
}

.discogs-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:8px;
  gap:8px;
  font-weight:600;
  font-size:14px;
}

#discogs-status{
  font-size:13px;
  color:#d1e9f6;
  margin-bottom:8px;
}

.discogs-progress{
  height:8px;
  background:#222;
  border-radius:8px;
  overflow:hidden;
  margin-bottom:10px;
}
#discogs-progress{
  height:100%;
  background:linear-gradient(90deg,#06b6d4,#3b82f6);
  width:0%;
  transition:width .3s ease;
}

.discogs-list{
  max-height: calc(70vh - 140px);
  overflow:auto;
  padding-right:8px;
}

.discogs-card{
  background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
  padding:10px;
  border-radius:8px;
  margin-bottom:10px;
  border:1px solid rgba(255,255,255,0.03);
}
.discogs-title{font-size:13px;font-weight:700;margin-bottom:4px;}
.discogs-meta{font-size:11px;color:#9aa3ad;margin-bottom:6px;}
.discogs-price{display:flex;justify-content:space-between;font-size:12px;margin:2px 0;}
.discogs-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}
.discogs-btn{display:inline-block;background:#2563eb;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;color:#fff;border:none;cursor:pointer;}
.discogs-btn-secondary{background:#374151;}

.discogs-list::-webkit-scrollbar{width:10px}
.discogs-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:6px}
.discogs-list::-webkit-scrollbar-track{background:transparent}

#discogs-close{cursor:pointer;color:#fff;padding:4px 8px;border-radius:6px;background:transparent}
#discogs-close:hover{background:rgba(255,255,255,0.03)}

.discogs-mini-badge{
  display:none;
  min-width:40px;
  padding:4px 8px;
  border-radius:12px;
  background:rgba(255,255,255,0.06);
  font-size:12px;
  text-align:center;
  color:#bde8ff;
  margin-left:8px;
}

#discogs-mini-indicator{
  position:fixed;
  right:18px;
  bottom:24px;
  width:56px;
  height:56px;
  border-radius:50%;
  background:linear-gradient(180deg,#0ea5a4,#2563eb);
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:12px;
  z-index:1000000;
  box-shadow:0 8px 20px rgba(0,0,0,.4);
  cursor:pointer;
  user-select:none;
}
#discogs-mini-indicator.hidden{ display:none; }
#discogs-mini-indicator small{ display:block; font-size:10px; opacity:0.9; line-height:1; text-align:center; padding:2px; }
`;
    document.head.appendChild(s);
  }

  function showError(m) {
    removeUI();
    const b = createUI();
    b.querySelector("#discogs-status").innerText = m;
    document.body.prepend(b);
  }

  function request(url, method, data, params) {
    return new Promise((resolve, reject) => {
      let u = url;
      if (params) {
        u += "?" + new URLSearchParams(params);
      }
      GM.xmlHttpRequest({
        method: method || "GET",
        url: u,
        headers: { "Content-Type": "application/json" },
        data: data ? JSON.stringify(data) : undefined,
        onload: (r) => {
          try {
            resolve(JSON.parse(r.responseText));
          } catch {
            resolve(r.responseText);
          }
        },
        onerror: (err) => {
          reject(err);
        },
      });
    });
  }

  function apiRequest(method, path, body, attemptRefresh = true) {
    return new Promise(async (resolve, reject) => {
      const session = getStoredSession();
      const url = `${CONFIG.API_BASE2}${path}`;

      const headers = {
        "Content-Type": "application/json",
      };

      if (session?.accessToken && !path.includes(CONFIG.AUTH_REFRESH)) {
        headers.authorization = `Bearer ${session.accessToken}`;
      }

      GM.xmlHttpRequest({
        method,
        url,
        headers,
        data: body ? JSON.stringify(body) : undefined,
        withCredentials: true,

        onload: async (res) => {
          const status = res.status;

          if (status >= 200 && status < 300) {
            if (status === 204) return resolve(undefined);
            try {
              resolve(JSON.parse(res.responseText));
            } catch {
              resolve(res.responseText);
            }
            return;
          }

          // 401対応
          const isAuthEndpoint = [
            "/auth/login",
            "/auth/register",
            "/auth/refresh",
          ].includes(path);

          if (status === 401 && attemptRefresh && !isAuthEndpoint) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              resolve(apiRequest(method, path, body, false));
              return;
            }
            setStoredSession(null);
          }

          try {
            const errorData = JSON.parse(res.responseText);
            reject(
              new HttpClientError(
                status,
                res.statusText,
                errorData.message || errorData.error,
              ),
            );
          } catch {
            reject(new Error(res.responseText));
          }
        },

        onerror: (err) => reject(err),
      });
    });
  }
  function getStoredSession() {
    let raw = null;
    raw = window.localStorage.getItem("digmap_auth_session");
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setStoredSession(session) {
    if (!session) {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  }

  async function refreshAccessToken() {
    const session = getStoredSession();
    if (!session?.refreshToken) return false;

    try {
      const refreshed = await apiRequest(
        "POST",
        CONFIG.AUTH_REFRESH,
        {
          refreshToken: session.refreshToken,
        },
        false,
      );

      if (refreshed?.accessToken) {
        setStoredSession({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? session.refreshToken,
          userId: refreshed.userId ?? session.userId,
        });
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[auth/refresh] failed", e);
      return false;
    }
  }
  async function login() {
    // const session = getStoredSession();
    // if (session) return false;

    try {
      const refreshed = await apiRequest(
        "POST",
        CONFIG.AUTH_LOGIN,
        {
          email: CONFIG.EMAIL,
          password: CONFIG.PASSWORD,
        },
        false,
      );

      if (refreshed?.accessToken) {
        setStoredSession({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? session.refreshToken,
          userId: refreshed.userId ?? session.userId,
        });
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[auth/login] failed", e);
      return false;
    }
  }
  class HttpClientError extends Error {
    constructor(status, statusText, message) {
      super(message || statusText || "Request failed");
      this.name = "HttpClientError";
      this.status = status;
      this.statusText = statusText;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
