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
  const regex = /<meta[^>]+(name|property)=["']?([^>"']+)["']?[^>]*content=["']([^"']*)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html))) {
    meta[m[2]] = decodeHTMLEntities(m[3]);
  }
  return meta;
}

function extractLinks(html: string, base: string): { href: string; text?: string }[] {
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
    return { url, success: true, status, title, textPreview: text, metadata, links };
  } catch (e: any) {
    return { url, success: false, error: e?.message ?? "fetch_error" };
  }
}

export const handleScrape: RequestHandler = async (req, res) => {
  const body = req.body as ScrapeRequest;
  const input = body?.urls?.length ? body.urls : body?.url ? [body.url] : [];
  if (!input.length) {
    res.status(400).json({ error: "Provide 'url' or 'urls'" });
    return;
  }
  const limited = input.slice(0, 10); // simple safety cap
  const results = await Promise.all(limited.map((u) => scrapeOne(u)));
  const payload: ScrapeResponse = { results };
  res.status(200).json(payload);
};
