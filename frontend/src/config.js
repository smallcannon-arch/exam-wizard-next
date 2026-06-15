const LOCAL_API_BASE_URL = "http://127.0.0.1:8787";

// 之後正式部署 Worker 後，把這裡改成正式網址。
// 例如：https://exam-wizard-next-proxy.smallcannon.workers.dev
const PRODUCTION_API_BASE_URL = "https://exam-wizard-next-proxy.example.workers.dev";

export function getApiBaseUrl(locationObject = globalThis.location) {
  const hostname = locationObject?.hostname || "";

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return LOCAL_API_BASE_URL;
  }

  return PRODUCTION_API_BASE_URL;
}