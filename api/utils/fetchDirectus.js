// /api/utils/fetchDirectus.js
export async function fetchWithRetry(url, options = {}, retries = 3, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      console.warn(`⚠️ Directus HTTP ${res.status} (try ${i + 1}/${retries})`);
    } catch (err) {
      console.warn(`⚠️ Fetch error (try ${i + 1}/${retries}): ${err.message}`);
    }
    await new Promise(r => setTimeout(r, delay * (i + 1))); // 0.5s, 1s, 1.5s
  }
  throw new Error("Failed to fetch Directus after retries");
}
