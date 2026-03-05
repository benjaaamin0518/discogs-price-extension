export type PagePayload = {
  description: string;
  title: string;
};

export type DiscogsResult = {
  title?: string;
  subtitle?: string;
  priceRange?: string;
  searchResults?: Array<{ title: string; uri: string }>;
};

export type geminiRequest = {
  title: string;
  description: string;
  accessToken: string;
};
export type geminiResponse =
  | {
      result: jsonResponse;
      status: number;
    }
  | { error: string; status: number };
export type jsonResponse = {
  catalog_number: string | null;
  matrix_number: string | null;
  artist: string | null;
  title: string | null;
  format: string | null;
  country: string | null;
  year: number | null;
  confidence: number;
};
export type discogsData = {
  resourceId: string;
  lowest: number | null;
  median: number | null;
  highest: number | null;
};

export type discogsDataRequest = {
  resourceIds: string[];
  accessToken: string;
};
export type discogsDataResponse =
  | {
      result: discogsData[];
      status: number;
    }
  | { error: string; status: number };
