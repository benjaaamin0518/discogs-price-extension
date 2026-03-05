let p=location.href,d=!1;u();h();function h(){new MutationObserver(()=>{location.href!==p&&(p=location.href,d=!1,u())}).observe(document,{subtree:!0,childList:!0})}async function u(){if(d||!x())return;await b();const e=f();e.title&&(d=!0,m(),await chrome.runtime.sendMessage({type:"pageData",payload:e}),chrome.runtime.onMessage.addListener((t,n,o)=>{(t==null?void 0:t.type)==="discogsResult"&&w(t.data),(t==null?void 0:t.type)==="requestPayload"&&o({payload:e})}))}function x(){return location.href.includes("mercari.com/item")||location.href.includes("auctions.yahoo.co.jp/jp/auction")}function b(){return new Promise(e=>{if(document.querySelector("h1")){e();return}const t=new MutationObserver(()=>{document.querySelector("h1")&&(t.disconnect(),e())});t.observe(document.body,{childList:!0,subtree:!0})})}function f(){var r,i,c;const e=((r=document.querySelector("h1"))==null?void 0:r.innerText)||"",t=(i=document.querySelector('[data-testid="description"]'))==null?void 0:i.textContent,n=(c=document.querySelector("#description"))==null?void 0:c.textContent;return{title:e,description:t||n||""}}function m(){l();const e=y();e.innerHTML="Discogs解析中...",document.body.prepend(e)}function g(e,t,n){return`
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
        <td style="border: 1px solid #ccc; padding: 4px;">${e??"N/A"}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 4px;">中間価格</td>
        <td style="border: 1px solid #ccc; padding: 4px;">${t??"N/A"}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ccc; padding: 4px;">最高価格</td>
        <td style="border: 1px solid #ccc; padding: 4px;">${n??"N/A"}</td>
      </tr>
      </tbody>
    </table>
  `}function v(e){chrome.storage.local.get(["watchlist"],t=>{var s,a;const n=(s=document.querySelector('[data-testid="price"]'))==null?void 0:s.textContent,o=(a=document.querySelector(".sc-1f0603b0-2.kxUAXU"))==null?void 0:a.textContent,r=n||o||"",c=[{id:e.id,title:(e==null?void 0:e.title)??"unknown",url:window.location.href,price:r,prices:`最低:${e.lowest??"N/A"} 中間:${e.median??"N/A"} 最高:${e.highest??"N/A"}`},...t.watchlist??[]];chrome.storage.local.set({watchlist:c},()=>c),alert("ウォッチリストに追加しました")})}function w(e){l();const t=y();t.innerHTML=e.map((r,i)=>`
    <div class="discogs-item">
      <div><a href="https://www.discogs.com/release/${r.id}" target="_blank"><b>${r.title}</b></a></div>
      <div>${r.format??""} ${r.year??""}</div>
      <div><a href="#" class="watchlist-btn" data-index="${i}" style="cursor:pointer;">ウォッチリストに追加</a></div>
      ${g(r.lowest,r.median,r.highest)}
      <hr/>
    </div>
  `).join(""),t.querySelectorAll(".watchlist-btn").forEach(r=>{r.addEventListener("click",i=>{i.preventDefault();const c=Number(r.dataset.index),s=e[c];v(s)})});const o=document.createElement("button");o.textContent="×",o.style.position="absolute",o.style.top="6px",o.style.right="8px",o.style.border="none",o.style.background="transparent",o.style.fontSize="14px",o.style.cursor="pointer",o.style.color="#fff",o.addEventListener("click",()=>l()),t.appendChild(o),document.body.prepend(t)}function y(){const e=document.createElement("div");return e.id="discogs-price-box",e.style.position="fixed",e.style.top="20px",e.style.right="20px",e.style.background="#111",e.style.color="#fff",e.style.padding="12px",e.style.fontSize="14px",e.style.borderRadius="12px",e.style.zIndex="999999",e.style.boxShadow="0 4px 12px rgba(0,0,0,0.4)",e.style.maxWidth="250px",e.style.maxHeight="60vh",e.style.overflowY="auto",e.style.overflowX="hidden",e.style.paddingRight="8px",e}function l(){const e=document.getElementById("discogs-price-box");e&&e.remove()}
