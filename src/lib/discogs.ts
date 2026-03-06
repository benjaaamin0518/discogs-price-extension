import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import {
  discogsDataRequest,
  discogsDataResponse,
  jsonResponse,
} from "../types";

function parseFormat(format: string | null): string[] {
  if (!format) return [];

  return format
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
const DISCOGS_TOKEN = import.meta.env.VITE_DISCOGS_TOKEN;

async function discogsSearch(params: Record<string, string>) {
  const qs = new URLSearchParams(params);

  const res = await fetch(
    `https://api.discogs.com/database/search?${qs}&token=${DISCOGS_TOKEN}`,
  );

  return res.json();
}
async function getRelease(id: number) {
  const res = await fetch(
    `https://api.discogs.com/releases/${id}?token=${DISCOGS_TOKEN}`,
  );

  return res.json();
}
async function getDiscogsData(ids: string[]) {
  let result: any[] = [];
  const options: AxiosRequestConfig<discogsDataRequest> = {
    url: import.meta.env.VITE_DISCOGS_DATA_ENDPOINT!,
    method: "POST",
    data: { resourceIds: ids, accessToken: import.meta.env.VITE_ACCESS_TOKEN! },
  };
  await axios<any, AxiosResponse<discogsDataResponse>, discogsDataRequest>(
    options,
  )
    .then((res) => {
      result = res.data && "result" in res.data ? res.data.result : [];
    })
    .catch((err) => {
      console.error("discogs data proxy call failed", err);
      throw new Error("discogs data proxy call failed: " + String(err));
    });
  return result;
}
const SIZE_SET = new Set(["LP", "EP"]);
function normalizeFormat(geminiFormat: string, discogsRelease: any) {
  const parts = parseFormat(geminiFormat);

  if (parts[0] !== "Vinyl") return parts;

  const descriptions = discogsRelease.formats?.[0]?.descriptions ?? [];

  let discogsSize: string | null = null;

  for (const d of descriptions) {
    if (SIZE_SET.has(d)) {
      discogsSize = d;
    }
  }

  let geminiSize = parts[1] ?? null;

  if (discogsSize) geminiSize = discogsSize;

  return ["Vinyl", geminiSize].filter(Boolean);
}
const getMedianPrice = async (releaseId: number) => {
  const res = await fetch(
    `https://api.discogs.com/marketplace/price_suggestions/${releaseId}?token=${DISCOGS_TOKEN}`,
  );
  const important = [
    "Mint (M)",
    "Near Mint (NM or M-)",
    "Very Good Plus (VG+)",
  ];

  const prices = getDiscogsPrices(await res.json());
  const filtered = prices.filter((p) => important.includes(p.condition));

  return { prices: filtered };
};
type DiscogsPrice = {
  currency: string;
  value: number;
};

export function getDiscogsPrices(data: Record<string, DiscogsPrice>) {
  const result: {
    condition: string;
    price: number;
  }[] = [];

  for (const [condition, info] of Object.entries(data)) {
    if (!info?.value) continue;

    result.push({
      condition,
      price: Math.round(info.value),
    });
  }

  return result;
}
export async function getDiscogsMedian(meta: jsonResponse): Promise<
  {
    id: number;
    title: string;
    format: string | null;
    year: number;
    lowest: number | null;
    median: number | null;
    highest: number | null;
  }[]
> {
  const formats = parseFormat(meta.format);

  const searchParams: Record<string, string> = {};

  if (meta.catalog_number) {
    searchParams.catno = meta.catalog_number;
  } else {
    if (meta.artist) {
      searchParams.artist = meta.artist;
    }

    if (meta.title) {
      searchParams.release_title = meta.title;
    }

    if (formats[0]) {
      searchParams.format = formats[0];
    }
  }

  // 1回目検索
  const search = await discogsSearch(searchParams);

  if (!search.results?.length) {
    return [];
  }

  const releaseId = search.results[0].id;

  // Vinyl以外は補正なし
  if (formats[0] !== "Vinyl") {
    // return await Promise.all(
    //   search.results.map(async (r: any) => ({
    //     id: r.id,
    //     title: r.title,
    //     format: r.format?.join(", "),
    //     year: r.year,
    //     ...(await getMedianPrice(r.id)),
    //   })),
    // );
    return await getDiscogsData(
      search.results.map((r: any) => r.id.toString()),
    ).then((data) =>
      data.map((d) => ({
        id: d.resourceId,
        title: search.results.find((r: any) => r.id.toString() === d.resourceId)
          ?.title,
        format: search.results
          .find((r: any) => r.id.toString() === d.resourceId)
          ?.format?.join(", "),
        year: search.results.find((r: any) => r.id.toString() === d.resourceId)
          ?.year,
        lowest: d.lowest,
        median: d.median,
        highest: d.highest,
      })),
    );
  }

  // release取得
  const release = await getRelease(releaseId);

  const normalized = normalizeFormat(meta.format!, release);

  if (normalized.length < 2) {
    // return await Promise.all(
    //   search.results.map(async (r: any) => ({
    //     id: r.id,
    //     title: r.title,
    //     format: r.format?.join(", "),
    //     year: r.year,
    //     ...(await getMedianPrice(r.id)),
    //   })),
    // );
    return await getDiscogsData(
      search.results.map((r: any) => r.id.toString()),
    ).then((data) =>
      data.map((d) => ({
        id: d.resourceId,
        title: search.results.find((r: any) => r.id.toString() === d.resourceId)
          ?.title,
        format: search.results
          .find((r: any) => r.id.toString() === d.resourceId)
          ?.format?.join(", "),
        year: search.results.find((r: any) => r.id.toString() === d.resourceId)
          ?.year,
        lowest: d.lowest,
        median: d.median,
        highest: d.highest,
      })),
    );
  }

  // 再検索
  const secondSearch = await discogsSearch({
    ...searchParams,

    format: normalized[0],
    format2: normalized[1],
  });
  // const result = await Promise.all(
  //   secondSearch.results.map(async (r: any) => ({
  //     id: r.id,
  //     title: r.title,
  //     format: r.format?.join(", "),
  //     year: r.year,
  //     ...(await getMedianPrice(r.id)),
  //   })),
  // );
  return await getDiscogsData(
    secondSearch.results.map((r: any) => r.id.toString()),
  ).then((data) =>
    data.map((d) => ({
      id: d.resourceId,
      title: secondSearch.results.find(
        (r: any) => r.id.toString() === d.resourceId,
      )?.title,
      format: secondSearch.results
        .find((r: any) => r.id.toString() === d.resourceId)
        ?.format?.join(", "),
      year: secondSearch.results.find(
        (r: any) => r.id.toString() === d.resourceId,
      )?.year,
      lowest: d.lowest,
      median: d.median,
      highest: d.highest,
    })),
  );
}
