// Content script: extract title and body heuristically and send to background
import type { PagePayload } from "./types";
export type messageCSUnionType = "discogsResult" | "requestPayload";

// =============================
// 設定
// =============================

let lastUrl = location.href;
let alreadyProcessed = false;

// =============================
// 初期化
// =============================

init();
observeUrlChange();

// =============================
// URL変更監視（SPA対策）
// =============================

function observeUrlChange() {
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      alreadyProcessed = false;
      init();
    }
  });

  observer.observe(document, {
    subtree: true,
    childList: true,
  });
}

// =============================
// メイン処理
// =============================

async function init() {
  if (alreadyProcessed) return;

  if (!isTargetPage()) return;

  await waitForTitle();

  const pageData = extractPageData();

  if (!pageData.title) return;

  alreadyProcessed = true;

  showLoadingUI();

  const result = await chrome.runtime.sendMessage({
    type: "pageData",
    payload: pageData,
  });
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "discogsResult") {
      injectResultUI(msg.data);
    }
    if (msg?.type === "requestPayload") {
      sendResponse({ payload: pageData });
    }
  });
}

// =============================
// 対象ページ判定
// =============================

function isTargetPage() {
  return (
    location.href.includes("mercari.com/item") ||
    location.href.includes("auctions.yahoo.co.jp/jp/auction")
  );
}

// =============================
// タイトル出現待機
// =============================

function waitForTitle() {
  return new Promise((resolve) => {
    if (document.querySelector("h1")) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector("h1")) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

// =============================
// データ抽出
// =============================

function extractPageData() {
  const title = document.querySelector("h1")?.innerText || "";

  const mercariDesc = document.querySelector(
    '[data-testid="description"]',
  )?.textContent;

  const yahooDesc = document.querySelector("#description")?.textContent;

  const description = mercariDesc || yahooDesc || "";

  return { title, description };
}

// =============================
// UI表示
// =============================

function showLoadingUI() {
  removeOldUI();

  const box = createBaseUI();
  box.innerHTML = "Discogs解析中...";
  document.body.prepend(box);
}
type DiscogsPrice = {
  currency: string;
  value: number;
};

export function getDiscogsPriceTable(
  lowest: number | null,
  median: number | null,
  highest: number | null,
) {
  // HTML表生成
  const html = `
    <table style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr>
          <th style="border: 1px solid #ccc; padding: 4px;">PriceRange</th>
          <th style="border: 1px solid #ccc; padding: 4px;">Price (¥)</th>
        </tr>
      </thead>
      <tbody>
      <tr>
        <td style="border: 1px solid #ccc; padding: 4px;">最低価格</td>
        <td style="border: 1px solid #ccc; padding: 4px;">${lowest ?? "N/A"}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 4px;">中間価格</td>
        <td style="border: 1px solid #ccc; padding: 4px;">${median ?? "N/A"}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 4px;">最高価格</td>
        <td style="border: 1px solid #ccc; padding: 4px;">${highest ?? "N/A"}</td>
      </tr>
      </tbody>
    </table>
  `;

  return html;
}
function addToWatchlist(data) {
  chrome.storage.local.get(["watchlist"], (r: any) => {
    const mercariPrice = document.querySelector(
      '[data-testid="price"]',
    )?.textContent;

    const yahooPrice = document.querySelector(
      ".sc-1f0603b0-2.kxUAXU",
    )?.textContent;

    const price = mercariPrice || yahooPrice || "";
    const entry = {
      id: data.id,
      title: data?.title ?? "unknown",
      url: window.location.href,
      price,
      prices: `最低:${data.lowest ?? "N/A"} 中間:${data.median ?? "N/A"} 最高:${data.highest ?? "N/A"}`,
    };
    const next = [entry, ...(r.watchlist ?? [])];
    chrome.storage.local.set({ watchlist: next }, () => next);
    alert("ウォッチリストに追加しました");
  });
}
function injectResultUI(data) {
  removeOldUI();

  const box = createBaseUI();

  // HTML生成
  box.innerHTML = data
    .map(
      (d, index) => `
    <div class="discogs-item">
      <div><a href="https://www.discogs.com/release/${d.id}" target="_blank"><b>${d.title}</b></a></div>
      <div>${d.format ?? ""} ${d.year ?? ""}</div>
      <div><a href="#" class="watchlist-btn" data-index="${index}" style="cursor:pointer;">ウォッチリストに追加</a></div>
      ${getDiscogsPriceTable(d.lowest, d.median, d.highest)}
      <hr/>
    </div>
  `,
    )
    .join("");

  // JS 側でイベント登録
  const buttons = box.querySelectorAll<HTMLAnchorElement>(".watchlist-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const index = Number(btn.dataset.index);
      const item = data[index];
      addToWatchlist(item);
    });
  });
  // add a close button
  const close = document.createElement("button");
  close.textContent = "×";
  close.style.position = "absolute";
  close.style.top = "6px";
  close.style.right = "8px";
  close.style.border = "none";
  close.style.background = "transparent";
  close.style.fontSize = "14px";
  close.style.cursor = "pointer";
  close.style.color = "#fff";
  close.addEventListener("click", () => removeOldUI());
  box.appendChild(close);

  document.body.prepend(box);
}
function createBaseUI() {
  const box = document.createElement("div");

  box.id = "discogs-price-box";

  box.style.position = "fixed";
  box.style.top = "20px";
  box.style.right = "20px";
  box.style.background = "#111";
  box.style.color = "#fff";
  box.style.padding = "12px";
  box.style.fontSize = "14px";
  box.style.borderRadius = "12px";
  box.style.zIndex = "999999";
  box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
  box.style.maxWidth = "250px";
  // allow vertical scrolling when content is large
  box.style.maxHeight = "60vh";
  box.style.overflowY = "auto";
  box.style.overflowX = "hidden";
  box.style.paddingRight = "8px";

  return box;
}

function removeOldUI() {
  const old = document.getElementById("discogs-price-box");
  if (old) old.remove();
}
// Listen for discogs result to show UI

function insertPanel(data: any) {
  // simple floating panel at top-right
  const id = "discogs-price-panel";
  if (document.getElementById(id)) return;
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.style.position = "fixed";
  wrap.style.top = "12px";
  wrap.style.right = "12px";
  wrap.style.zIndex = "999999";
  wrap.style.background = "white";
  wrap.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  wrap.style.borderRadius = "8px";
  wrap.style.padding = "8px";
  wrap.style.fontSize = "13px";
  wrap.style.color = "#111";
  wrap.style.maxWidth = "320px";

  const title = document.createElement("div");
  title.style.fontWeight = "600";
  title.style.marginBottom = "6px";
  title.textContent = "Discogs";
  wrap.appendChild(title);

  if (!data) {
    const p = document.createElement("div");
    p.textContent = "No results";
    wrap.appendChild(p);
  } else {
    const html = document.createElement("div");
    // render basic info and price ranges if provided
    html.innerHTML = `
      <div style="margin-bottom:6px"><strong>${escapeHtml(data.title || "")}</strong></div>
      <div style="font-size:12px;color:#444">${escapeHtml(data.subtitle || "")}</div>
    `;
    if (data.priceRange) {
      const pr = document.createElement("div");
      pr.style.marginTop = "6px";
      pr.innerHTML = `<div style="font-weight:600">価格帯</div><div>${escapeHtml(data.priceRange)}</div>`;
      html.appendChild(pr);
    } else if (data.searchResults && data.searchResults.length) {
      const list = document.createElement("div");
      list.style.marginTop = "6px";
      list.innerHTML = '<div style="font-weight:600">候補</div>';
      data.searchResults.slice(0, 3).forEach((r: any) => {
        const a = document.createElement("a");
        a.href = r.uri;
        a.textContent = r.title;
        a.target = "_blank";
        a.style.display = "block";
        list.appendChild(a);
      });
      html.appendChild(list);
    }
    wrap.appendChild(html);
  }

  const close = document.createElement("button");
  close.textContent = "×";
  close.style.position = "absolute";
  close.style.top = "6px";
  close.style.right = "8px";
  close.style.border = "none";
  close.style.background = "transparent";
  close.style.fontSize = "14px";
  close.style.cursor = "pointer";
  close.addEventListener("click", () => wrap.remove());
  wrap.appendChild(close);

  document.documentElement.appendChild(wrap);
}

function escapeHtml(s: string) {
  return s
    ? s.replace(
        /[&<>\"]/g,
        (c) =>
          (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }) as any)[
            c
          ],
      )
    : "";
}
