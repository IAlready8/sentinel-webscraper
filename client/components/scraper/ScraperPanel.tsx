import { useMutation } from "@tanstack/react-query";
import type { ScrapeResponse, ScrapeItem } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";

interface Options {
  timeout: number; // seconds
  concurrency: number;
  userAgent: string;
}

function toCSV(items: ScrapeItem[]): string {
  const headers = [
    "url",
    "success",
    "status",
    "title",
    "words",
    "links",
  ];
  const rows = items.map((r) => [
    r.url,
    String(r.success),
    r.status ?? "",
    (r.title ?? "").replace(/\n|\r/g, " "),
    r.textPreview ? r.textPreview.split(/\s+/).length : 0,
    r.links ? r.links.length : 0,
  ]);
  return [headers.join(","), ...rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
}

export default function ScraperPanel() {
  const [urlsText, setUrlsText] = useState("");
  const [opts, setOpts] = useState<Options>({ timeout: 12, concurrency: 4, userAgent: navigator.userAgent });
  const [results, setResults] = useState<ScrapeItem[] | null>(null);

  const mutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, options: opts }),
      });
      if (!res.ok) throw new Error("Scrape failed");
      return (await res.json()) as ScrapeResponse;
    },
    onSuccess: (data) => setResults(data.results),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const urls = urlsText
      .split(/\n|,|\s+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
    if (urls.length) mutation.mutate(urls.slice(0, 25));
  };

  const exportJSON = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scrape-results.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!results) return;
    const csv = toCSV(results);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scrape-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const totals = useMemo(() => {
    if (!results) return null;
    const success = results.filter((r) => r.success).length;
    const links = results.reduce((a, r) => a + (r.links?.length ?? 0), 0);
    return { total: results.length, success, links };
  }, [results]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste URLs to Scrape</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-5">
            <Textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder="https://example.com\nhttps://httpbin.org/html"
              className="min-h-32"
            />
            <div className="grid md:grid-cols-3 gap-4 items-center">
              <div>
                <Label htmlFor="ua">User-Agent</Label>
                <Input id="ua" value={opts.userAgent} onChange={(e) => setOpts({ ...opts, userAgent: e.target.value })} />
              </div>
              <div>
                <Label>Timeout (s)</Label>
                <div className="flex items-center gap-3">
                  <Slider value={[opts.timeout]} min={5} max={30} step={1} onValueChange={(v) => setOpts({ ...opts, timeout: v[0] })} />
                  <span className="w-10 text-sm text-right">{opts.timeout}</span>
                </div>
              </div>
              <div>
                <Label>Concurrency</Label>
                <div className="flex items-center gap-3">
                  <Slider value={[opts.concurrency]} min={1} max={10} step={1} onValueChange={(v) => setOpts({ ...opts, concurrency: v[0] })} />
                  <span className="w-10 text-sm text-right">{opts.concurrency}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Scraping..." : "Scrape"}
              </Button>
              {totals && (
                <div className="text-sm text-foreground/60">
                  <Badge variant="outline" className="mr-2">{totals.success}/{totals.total} success</Badge>
                  <Badge variant="outline">{totals.links} links</Badge>
                </div>
              )}
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={exportCSV} disabled={!results}>Export CSV</Button>
              <Button type="button" variant="outline" onClick={exportJSON} disabled={!results}>Export JSON</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL / Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Words</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.url}>
                    <TableCell className="max-w-[420px]">
                      <div className="font-medium truncate" title={r.title ?? r.url}>{r.title ?? r.url}</div>
                      <a className="text-xs text-primary underline underline-offset-4 break-all" href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                    </TableCell>
                    <TableCell>
                      {r.success ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600">{r.status}</Badge>
                      ) : (
                        <Badge className="bg-rose-500/15 text-rose-600">error</Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.textPreview ? r.textPreview.split(/\s+/).length : 0}</TableCell>
                    <TableCell>{r.links?.length ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <a href={r.url} target="_blank" rel="noreferrer">Open</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
