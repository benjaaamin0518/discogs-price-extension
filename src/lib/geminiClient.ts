import type {
  geminiRequest,
  geminiResponse,
  jsonResponse,
  PagePayload,
} from "../types";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

type GeminiConfig = {
  endpoint?: string;
};

export async function callGeminiLike(cfg: GeminiConfig, payload: PagePayload) {
  if (!cfg) throw new Error("no gemini config");
  if (!cfg.endpoint)
    throw new Error("no gemini endpoint configured for proxy mode");
  const options: AxiosRequestConfig<geminiRequest> = {
    url: cfg.endpoint,
    method: "POST",
    data: { ...payload, accessToken: import.meta.env.VITE_ACCESS_TOKEN },
  };
  let result: jsonResponse = {
    catalog_number: null,
    matrix_number: null,
    artist: null,
    title: null,
    format: null,
    country: null,
    year: null,
    confidence: 0,
  };
  await axios<any, AxiosResponse<geminiResponse>, geminiRequest>(options)
    .then((res) => {
      result = res.data && "result" in res.data ? res.data.result : result;
    })
    .catch((err) => {
      console.error("gemini proxy call failed", err);
      throw new Error("gemini proxy call failed: " + String(err));
    });
  return result;
}
