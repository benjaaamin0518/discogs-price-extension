import type { PagePayload, DiscogsResult } from "./types";
import { getStorage } from "./lib/chromeApi";
import { getDiscogsMedian } from "./lib/discogs";
import { callGeminiLike } from "./lib/geminiClient";
export type currentPageObjType = { url: string; title: string };
export type messageBGUnionType = "requestPayload" | "pageData";
const CATALOG_REGEXES = [
  /([A-Z0-9]{2,}-\d{1,5})/g,
  /([A-Z]{2,}\s?\d{1,5})/g,
  /(SR|SRV|PC|XL)[-\s]?\d{1,5}/gi,
  /\bcat[:#\s]?([A-Z0-9-]{2,})\b/gi,
];

chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (msg?.type === "pageData") {
      handlePage(msg.payload as PagePayload)
        .then((res) => {
          // send back to content script
          if (tabId)
            chrome.tabs.sendMessage(tabId, {
              type: "discogsResult",
              data: res,
            });
          sendResponse({ ok: true });
        })
        .catch((err) => {
          console.error("background handlePage error", err);
          sendResponse({ ok: false, error: String(err) });
        });
      return true;
    }
  });
});

async function handlePage(payload: PagePayload): Promise<any[]> {
  const candidates = extractCatalogNumbers(payload.title + "\n" + payload.body);

  console.log("calling gemini-like with payload:", payload);
  const g = await callGeminiLike(
    { endpoint: (import.meta as any).env?.VITE_GEMINI_ENDPOINT },
    payload,
  );

  const price = await getDiscogsMedian(g);
  return price;
}

function extractCatalogNumbers(s: string): string[] {
  const found = new Set<string>();
  for (const rx of CATALOG_REGEXES) {
    let m;
    while ((m = rx.exec(s))) {
      if (m[1]) found.add(m[1].toString());
    }
  }
  return Array.from(found);
}
