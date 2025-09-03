import type { RequestHandler } from "express";
import type { ScrapeRequest, ScrapeResponse, ScrapeItem } from "@shared/api";

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeHTMLEntities(m[1].trim()) : undefined;
}

function stripTags(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = withoutScripts.replace(/<[^>]+>/g, " ");
  return collapseWhitespace(decodeHTMLEntities(text));
}

function extractMeta(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const regex =
    /<meta[^>]+(name|property)=["']?([^>"']+)["']?[^>]*content=["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html))) {
    meta[m[2]] = decodeHTMLEntities(m[3]);
  }
  return meta;
}

function extractLinks(
  html: string,
  base: string,
): { href: string; text?: string }[] {
  const links: { href: string; text?: string }[] = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html))) {
    try {
      const hrefRaw = m[1];
      const text = collapseWhitespace(stripTags(m[2]).slice(0, 120));
      const resolved = new URL(hrefRaw, base).toString();
      if (resolved.startsWith("http")) links.push({ href: resolved, text });
    } catch {}
  }
  return dedupeBy(links, (l) => l.href).slice(0, 100);
}

function collapseWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
function decodeHTMLEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
function dedupeBy<T>(arr: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

async function scrapeOne(url: string): Promise<ScrapeItem> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const status = res.status;
    const html = await res.text();
    const title = extractTitle(html);
    const text = stripTags(html).slice(0, 1200);
    const metadata = extractMeta(html);
    const links = extractLinks(html, url);
    return {
      url,
      success: true,
      status,
      title,
      textPreview: text,
      metadata,
      links,
    };
  } catch (e: any) {
    return { url, success: false, error: e?.message ?? "fetch_error" };
  }
}

export const handleScrape: RequestHandler = async (req, res) => {
  const body = req.body as any;
  const input: string[] = body?.urls?.length ? body.urls : body?.url ? [body.url] : [];
  if (!input.length) {
    res.status(400).json({ error: "Provide 'url' or 'urls'" });
    return;
  }
  const options = body?.options || {};
  const ua: string | undefined = options.userAgent;
  const timeoutSec: number = Math.min(Math.max(Number(options.timeout) || 12, 5), 30);
  const concurrency: number = Math.min(Math.max(Number(options.concurrency) || 4, 1), 10);

  const limited = input.slice(0, 25);

  const queue = [...limited];
  const results: ScrapeItem[] = [];

  async function worker() {
    while (queue.length) {
      const url = queue.shift()!;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutSec * 1000);
      try {
        const r = await fetch(url, {
          redirect: "follow",
          signal: controller.signal,
          headers: ua ? { "user-agent": ua } : undefined,
        });
        const status = r.status;
        const type = r.headers.get("content-type") || "";
        let text = "";
        if (type.includes("text") || type.includes("html") || type.includes("xml")) {
          text = await r.text();
        }
        clearTimeout(t);
        if (!text) {
          results.push({ url, success: true, status, title: undefined, textPreview: undefined, links: [], metadata: { contentType: type } });
          continue;
        }
        const title = extractTitle(text) || extractMeta(text)["og:title"];
        const preview = stripTags(text).slice(0, 3000);
        const links = extractLinks(text, url);
        const metadata = extractMeta(text);
        results.push({ url, success: true, status, title, textPreview: preview, links, metadata });
      } catch (e: any) {
        results.push({ url, success: false, error: e?.message || "error" });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const payload: ScrapeResponse = { results };
  res.status(200).json(payload);
};
