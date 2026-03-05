import React, { useEffect, useState } from "react";
import type { DiscogsResult } from "../types";

function App() {
  const [data, setData] = useState<DiscogsResult | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);

  useEffect(() => {
    // ask background to process current tab

    chrome.storage.local.get(["watchlist"], (r: any) => {
      setWatchlist(r.watchlist ?? []);
    });
  }, []);

  return (
    <div
      style={{
        width: 360,
        padding: 12,
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto',
      }}>
      <h3 style={{ margin: "0 0 8px 0" }}>Discogs Price</h3>
      <div>
        <div style={{ fontWeight: 600 }}>ウォッチリスト</div>
        {watchlist.length ? (
          watchlist.map((w) => (
            <div
              key={w.id}
              style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
              {w.title}
              <a
                href={w.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 8, fontSize: 12 }}>
                (リンク)
              </a>
              <br />
              当時の価格:{w.price}
              <br />
              {w.prices}
            </div>
          ))
        ) : (
          <div style={{ color: "#666" }}>空です</div>
        )}
      </div>
    </div>
  );
}

export default App;
