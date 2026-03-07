let d=location.href;var y;let s=((y=document.querySelector("h1"))==null?void 0:y.innerText)||"",a=!1;h();f();function f(){new MutationObserver(()=>{var o;const t=location.href,r=((o=document.querySelector("h1"))==null?void 0:o.innerText)||"";t!==d&&(console.log("[ContentScript] URL changed detected:",{oldUrl:d,newUrl:t,oldTitle:s,newTitle:r}),d=t,s=r,a=!1,g().then(()=>{h()}))}).observe(document,{subtree:!0,childList:!0})}function g(){return new Promise(e=>{let r=0;const o=300,n=()=>{var c;const i=((c=document.querySelector("h1"))==null?void 0:c.innerText)||"";if(i&&i!==s){console.log("[ContentScript] New title detected:",i),s=i,e();return}r++,r<o?setTimeout(n,100):(console.log("[ContentScript] Title change timeout, proceeding anyway"),e())};n()})}async function h(){if(a||!b())return;console.log("[ContentScript] Clearing old title and waiting for new one..."),await m();const e=w();console.log("[ContentScript] Page data extracted:",e),e.title&&(a=!0,T(),await chrome.runtime.sendMessage({type:"pageData",payload:e}),chrome.runtime.onMessage.addListener((t,r,o)=>{(t==null?void 0:t.type)==="discogsResult"&&C(t.data),(t==null?void 0:t.type)==="requestPayload"&&o({payload:e})}))}function b(){return location.href.includes("mercari.com/item")||location.href.includes("auctions.yahoo.co.jp/jp/auction")}function m(){return new Promise(e=>{const t=document.querySelector("h1");if(t&&t.innerText){console.log("[waitForTitle] Title already available:",t.innerText),e();return}console.log("[waitForTitle] Waiting for h1 element...");const r=new MutationObserver(()=>{const o=document.querySelector("h1");o&&o.innerText&&(console.log("[waitForTitle] Title loaded:",o.innerText),r.disconnect(),e())});r.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{r.disconnect(),console.warn("[waitForTitle] Timeout waiting for h1, proceeding anyway"),e()},1e4)})}function w(){var n,i,c;const e=((n=document.querySelector("h1"))==null?void 0:n.innerText)||"",t=(i=document.querySelector('[data-testid="description"]'))==null?void 0:i.textContent,r=(c=document.querySelector("#description"))==null?void 0:c.textContent;return{title:e,description:t||r||""}}function T(){u();const e=x();e.innerHTML="Discogs解析中...",document.body.prepend(e)}function v(e,t,r){return`
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
        <td style="border: 1px solid #ccc; padding: 4px;">${r??"N/A"}</td>
      </tr>
      </tbody>
    </table>
  `}function S(e){chrome.storage.local.get(["watchlist"],t=>{var l,p;const r=(l=document.querySelector('[data-testid="price"]'))==null?void 0:l.textContent,o=(p=document.querySelector(".sc-1f0603b0-2.kxUAXU"))==null?void 0:p.textContent,n=r||o||"",c=[{id:e.id,title:(e==null?void 0:e.title)??"unknown",url:window.location.href,price:n,prices:`最低:${e.lowest??"N/A"} 中間:${e.median??"N/A"} 最高:${e.highest??"N/A"}`},...t.watchlist??[]];chrome.storage.local.set({watchlist:c},()=>c),alert("ウォッチリストに追加しました")})}function C(e){u();const t=x();t.innerHTML=e.map((n,i)=>`
    <div class="discogs-item">
      <div><a href="https://www.discogs.com/release/${n.id}" target="_blank"><b>${n.title}</b></a></div>
      <div>${n.format??""} ${n.year??""}</div>
      <div><a href="#" class="watchlist-btn" data-index="${i}" style="cursor:pointer;">ウォッチリストに追加</a></div>
      ${v(n.lowest,n.median,n.highest)}
      <hr/>
    </div>
  `).join(""),t.querySelectorAll(".watchlist-btn").forEach(n=>{n.addEventListener("click",i=>{i.preventDefault();const c=Number(n.dataset.index),l=e[c];S(l)})});const o=document.createElement("button");o.textContent="×",o.style.position="absolute",o.style.top="6px",o.style.right="8px",o.style.border="none",o.style.background="transparent",o.style.fontSize="14px",o.style.cursor="pointer",o.style.color="#fff",o.addEventListener("click",()=>u()),t.appendChild(o),document.body.prepend(t)}function x(){const e=document.createElement("div");return e.id="discogs-price-box",e.style.position="fixed",e.style.top="20px",e.style.right="20px",e.style.background="#111",e.style.color="#fff",e.style.padding="12px",e.style.fontSize="14px",e.style.borderRadius="12px",e.style.zIndex="999999",e.style.boxShadow="0 4px 12px rgba(0,0,0,0.4)",e.style.maxWidth="250px",e.style.maxHeight="60vh",e.style.overflowY="auto",e.style.overflowX="hidden",e.style.paddingRight="8px",e}function u(){const e=document.getElementById("discogs-price-box");e&&e.remove()}
