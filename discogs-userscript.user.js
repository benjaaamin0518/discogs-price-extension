// ==UserScript==
// @name         Discogs Price Helper
// @namespace    http://tampermonkey.net/
// @version      0.1.1
// @description  Show Discogs price ranges on Mercari and Yahoo Auctions listings
// @author       You
// @match        https://jp.mercari.com/item/*
// @match        *://auctions.yahoo.co.jp/jp/auction/*
// @match        *://aucfree.com/*
// @match        *://yahoo.co.jp/*
// @grant        GM_xmlHttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.getValue
// @grant        GM.setValue
// @connect      api.discogs.com
// @connect      *
// ==/UserScript==

(async function () {
  "use strict";

  console.log("[Discogs Price Helper] Script initialized");

  // =============================
  // 設定（環境変数を置き換え）
  // =============================
  const CONFIG = {
    // これらはUserscriptの設定画面やGM_setValueで変更できるようにしておく
    GEMINI_ENDPOINT: "http:/34.169.231.99:3000/api/v1/gemini",
    DISCOGS_TOKEN: "", // 検索用
    DISCOGS_ENDPOINT: "http://34.169.231.99:3000/api/v1/discogsData",
    ACCESS_TOKEN: "kX9%^mZ7GYd7dduV^m&t5wX9s8Z5n",
  };

  console.log("[Discogs Price Helper] CONFIG:", {
    GEMINI_ENDPOINT: CONFIG.GEMINI_ENDPOINT ? "✓ Set" : "✗ Not set",
    DISCOGS_TOKEN: CONFIG.DISCOGS_TOKEN ? "✓ Set" : "✗ Not set",
    DISCOGS_ENDPOINT: CONFIG.DISCOGS_ENDPOINT ? "✓ Set" : "✗ Not set",
    ACCESS_TOKEN: CONFIG.ACCESS_TOKEN ? "✓ Set" : "✗ Not set",
  });

  // 必要な設定が欠けていれば初回設定を実行
  if (
    !CONFIG.GEMINI_ENDPOINT ||
    !CONFIG.DISCOGS_ENDPOINT ||
    !CONFIG.ACCESS_TOKEN
  ) {
    initializeConfig();
    return;
  }

  // =============================
  // 状態管理
  // =============================
  let lastUrl = location.href;
  let lastTitle = document.querySelector("h1")?.innerText || "";
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
      const currentUrl = location.href;
      const currentTitle = document.querySelector("h1")?.innerText || "";

      if (currentUrl !== lastUrl) {
        console.log("[Discogs Price Helper] URL changed detected:", {
          oldUrl: lastUrl,
          newUrl: currentUrl,
          oldTitle: lastTitle,
          newTitle: currentTitle,
        });

        lastUrl = currentUrl;
        lastTitle = currentTitle;
        alreadyProcessed = false;
        removeOldUI(); // 古いUIをクリア

        // URL変更後、新しいタイトルが読み込まれるまで待機
        waitForTitleChange().then(() => {
          init();
        });
      }
    });

    observer.observe(document, {
      subtree: true,
      childList: true,
    });
  }

  // =============================
  // タイトル変更待機（URL変更後の新タイトル検出）
  // =============================
  function waitForTitleChange() {
    return new Promise((resolve) => {
      const checkInterval = 100;
      let retries = 0;
      const maxRetries = 300; // 最大30秒待機

      const check = () => {
        const currentTitle = document.querySelector("h1")?.innerText || "";

        // 新しいタイトルが異なり、かつ空でない場合に解決
        if (currentTitle && currentTitle !== lastTitle) {
          console.log(
            "[Discogs Price Helper] New title detected:",
            currentTitle,
          );
          lastTitle = currentTitle;
          resolve();
          return;
        }

        retries++;
        if (retries < maxRetries) {
          setTimeout(check, checkInterval);
        } else {
          console.log(
            "[Discogs Price Helper] Title change timeout, proceeding anyway",
          );
          resolve();
        }
      };

      check();
    });
  }

  // =============================
  // メイン処理
  // =============================
  async function init() {
    if (alreadyProcessed) {
      console.log("[Discogs Price Helper] Already processed, skipping...");
      return;
    }

    const isTarget = isTargetPage();
    console.log("[Discogs Price Helper] Page check:", {
      url: location.href,
      isTargetPage: isTarget,
    });

    if (!isTarget) return;

    // 新しいタイトルをクリアして待機
    console.log(
      "[Discogs Price Helper] Clearing old title and waiting for new one...",
    );
    await waitForTitle();

    const pageData = extractPageData();
    console.log("[Discogs Price Helper] Page data extracted:", pageData);

    if (!pageData.title) {
      console.log("[Discogs Price Helper] No title found, skipping...");
      return;
    }

    alreadyProcessed = true;

    showLoadingUI();

    try {
      const result = await handlePage(pageData);
      console.log("[Discogs Price Helper] Results:", result);
      injectResultUI(result);
    } catch (err) {
      console.error("[Discogs Price Helper] Error:", err);
      showErrorUI("エラーが発生しました: " + String(err));
    }
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
      const h1 = document.querySelector("h1");
      if (h1 && h1.innerText) {
        console.log("[waitForTitle] Title already available:", h1.innerText);
        resolve();
        return;
      }

      console.log("[waitForTitle] Waiting for h1 element...");
      const observer = new MutationObserver(() => {
        const h1 = document.querySelector("h1");
        if (h1 && h1.innerText) {
          console.log("[waitForTitle] Title loaded:", h1.innerText);
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // 最大10秒待機してもタイトルが出現しなければ強制的に続行
      setTimeout(() => {
        observer.disconnect();
        console.warn(
          "[waitForTitle] Timeout waiting for h1, proceeding anyway",
        );
        resolve();
      }, 10000);
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
  // バックエンド処理
  // =============================
  async function handlePage(payload) {
    console.log("[handlePage] Sending request to Gemini endpoint...");
    const response = await gmFetch(CONFIG.GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        title: payload.title,
        description: payload.description,
        accessToken: CONFIG.ACCESS_TOKEN,
      },
    });

    console.log("[handlePage] Gemini response:", response);

    if (response.error) {
      throw new Error("Geminiエラー: " + response.error);
    }

    // geminiResultがnullの場合は空配列を返す
    const geminiResult = response.result;
    if (!geminiResult || !geminiResult.title) {
      throw new Error("Geminiが商品情報を解析できませんでした");
    }

    console.log("[handlePage] Gemini result:", geminiResult);

    const discogsResult = await getDiscogsMedian([geminiResult]);

    return discogsResult;
  }

  // =============================
  // ユーティリティ関数
  // =============================
  function parseFormat(format) {
    if (!format) return [];
    return format
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function normalizeFormat(geminiFormat, discogsRelease) {
    const parts = parseFormat(geminiFormat);

    if (parts[0] !== "Vinyl") return parts;

    const descriptions = discogsRelease.formats?.[0]?.descriptions ?? [];
    const SIZE_SET = new Set(["LP", "EP"]);

    let discogsSize = null;
    for (const d of descriptions) {
      if (SIZE_SET.has(d)) {
        discogsSize = d;
      }
    }

    let geminiSize = parts[1] ?? null;
    if (discogsSize) geminiSize = discogsSize;

    return ["Vinyl", geminiSize].filter(Boolean);
  }

  // =============================
  // Discogs API呼び出し
  // =============================
  async function discogsSearch(params) {
    const searchParams = { ...params };
    console.log("[discogsSearch] Searching with params:", searchParams);
    const response = await gmFetch("https://api.discogs.com/database/search", {
      params: searchParams,
    });
    console.log(
      "[discogsSearch] Found results:",
      response.results?.length || 0,
    );
    return response;
  }

  async function getRelease(id) {
    console.log("[getRelease] Getting release:", id);
    const response = await gmFetch(`https://api.discogs.com/releases/${id}`, {
      params: { token: CONFIG.DISCOGS_TOKEN },
    });
    return response;
  }

  // 価格取得は外部のプロキシAPI（Discogs Data API）を使用します。

  async function fetchPriceData(ids) {
    if (!ids || ids.length === 0) return [];
    console.log("[fetchPriceData] requesting for ids", ids);
    const resp = await gmFetch(CONFIG.DISCOGS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        resourceIds: ids,
        accessToken: CONFIG.ACCESS_TOKEN,
      },
    });
    // APIは { result: Array<{resourceId,lowest,median,highest}> } を返す想定
    const list = resp?.result || [];
    console.log("[fetchPriceData] received", list);
    return list;
  }

  // =============================
  // Discogs データ取得（本体）
  // =============================
  async function getDiscogsMedian(metaArray) {
    if (!metaArray || metaArray.length === 0) {
      console.log("[getDiscogsMedian] No metadata, returning empty");
      return [];
    }

    const results = [];

    for (const meta of metaArray) {
      try {
        console.log("[getDiscogsMedian] Processing:", meta);
        const formats = parseFormat(meta.format);
        const searchParams = {};

        // カタログナンバーがあれば優先
        if (meta.catalog_number) {
          searchParams.catno = meta.catalog_number;
        } else {
          if (meta.artist) searchParams.artist = meta.artist;
          if (meta.title) searchParams.release_title = meta.title;
          if (formats[0]) searchParams.format = formats[0];
        }

        // 1回目検索
        const search = await discogsSearch(searchParams);

        if (!search.results?.length) {
          console.log("[getDiscogsMedian] No search results");
          continue;
        }

        const releaseId = search.results[0].id;
        let finalResults = search.results;

        // Vinyl の場合は詳細な補正を行う
        if (formats[0] === "Vinyl") {
          try {
            console.log(
              "[getDiscogsMedian] Vinyl found, normalizing format...",
            );
            const release = await getRelease(releaseId);
            const normalized = normalizeFormat(meta.format, release);
            console.log("[getDiscogsMedian] Normalized format:", normalized);

            if (normalized.length >= 2) {
              // 2回目検索（正規化されたサイズ付き）
              const secondSearch = await discogsSearch({
                ...searchParams,
                format: normalized[0],
                format2: normalized[1],
              });

              if (secondSearch.results?.length) {
                finalResults = secondSearch.results;
                console.log(
                  "[getDiscogsMedian] Second search results:",
                  finalResults.length,
                );
              }
            }
          } catch (err) {
            console.warn(
              "[getDiscogsMedian] Vinyl normalization failed, using original results:",
              err,
            );
          }
        }

        // 各結果の価格情報を取得　→ 外部APIを利用
        const ids = finalResults.map((r) => r.id.toString());
        const priceList = await fetchPriceData(ids);

        for (const result of finalResults) {
          const priceInfo = priceList.find(
            (p) => p.resourceId === result.id.toString(),
          );
          results.push({
            id: result.id,
            title: result.title,
            format: result.format?.join(", ") || null,
            year: result.year,
            lowest: priceInfo?.lowest ?? null,
            median: priceInfo?.median ?? null,
            highest: priceInfo?.highest ?? null,
          });
        }
      } catch (err) {
        console.error(
          "[getDiscogsMedian] Error processing metadata:",
          meta,
          err,
        );
      }
    }

    console.log("[getDiscogsMedian] Final results:", results);
    return results;
  }

  // =============================
  // GM_xmlHttpRequest ラッパー
  // =============================
  function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      const method = options.method || "GET";
      const headers = { ...options.headers };
      let finalUrl = url;

      // URLパラメータ の処理
      if (options.params) {
        const qs = new URLSearchParams(options.params).toString();
        finalUrl = `${url}?${qs}`;
      }

      console.log("[gmFetch]", method, finalUrl);

      const config = {
        method,
        url: finalUrl,
        headers,
        onload: (response) => {
          console.log("[gmFetch] Response status:", response.status);
          try {
            const result = JSON.parse(response.responseText);
            resolve(result);
          } catch (e) {
            console.warn(
              "[gmFetch] Failed to parse as JSON, returning raw text",
            );
            resolve(response.responseText);
          }
        },
        onerror: (err) => {
          console.error("[gmFetch] Network error:", err);
          reject(new Error("Network error: " + String(err)));
        },
        ontimeout: () => {
          console.error("[gmFetch] Request timeout");
          reject(new Error("Request timeout"));
        },
      };

      // POSTデータの処理
      if (options.data) {
        config.data = JSON.stringify(options.data);
      }

      GM.xmlHttpRequest(config);
    });
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

  function showErrorUI(message) {
    removeOldUI();

    const box = createBaseUI();
    box.style.background = "#f8d7da";
    box.style.color = "#721c24";
    box.innerHTML = message;
    document.body.prepend(box);
  }

  function getDiscogsPriceTable(lowest, median, highest) {
    const html = `
      <table style="border-collapse: collapse; width: 100%; margin-top: 8px;">
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
      timestamp: new Date().toISOString(),
    };

    try {
      const watchlist = GM_getValue("watchlist", []);
      const next = [entry, ...watchlist];
      GM_setValue("watchlist", next);
      console.log("[Discogs Price Helper] Added to watchlist:", entry);
      alert("ウォッチリストに追加しました");
    } catch (err) {
      console.error("[Discogs Price Helper] Failed to add to watchlist:", err);
      alert("ウォッチリストへの追加に失敗しました");
    }
  }

  function injectResultUI(data) {
    removeOldUI();

    const box = createBaseUI();

    box.innerHTML = data
      .map(
        (d, index) => `
      <div class="discogs-item" style="margin-bottom: 12px;">
        <div><a href="https://www.discogs.com/release/${d.id}" target="_blank" style="color: #0066cc; font-weight: bold;"><b>${d.title}</b></a></div>
        <div style="font-size: 12px; color: #666;">${d.format ?? ""} ${d.year ?? ""}</div>
        <div><a href="#" class="watchlist-btn" data-index="${index}" style="cursor:pointer; color: #0066cc; font-size: 12px;">ウォッチリストに追加</a></div>
        ${getDiscogsPriceTable(d.lowest, d.median, d.highest)}
        <hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;"/>
      </div>
    `,
      )
      .join("");

    const buttons = box.querySelectorAll(".watchlist-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const index = Number(btn.dataset.index);
        const item = data[index];
        addToWatchlist(item);
      });
    });

    const close = document.createElement("button");
    close.textContent = "×";
    close.style.position = "absolute";
    close.style.top = "6px";
    close.style.right = "8px";
    close.style.border = "none";
    close.style.background = "transparent";
    close.style.fontSize = "20px";
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
    box.style.zIndex = "999999";
    box.style.maxHeight = "70vh";
    box.style.overflow = "auto";
    box.style.backgroundColor = "#222";
    box.style.color = "#fff";
    box.style.padding = "12px";
    box.style.borderRadius = "8px";
    box.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.3)";
    box.style.fontFamily = "Arial, sans-serif";
    box.style.fontSize = "14px";
    box.style.maxWidth = "320px";

    return box;
  }

  function removeOldUI() {
    document.getElementById("discogs-price-box")?.remove();
  }
})();
