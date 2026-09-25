// Smoke test for the homepage redirect, run against a deployment:
//   node --test tests/
//   BASE_URLS=https://<preview>.vercel.app node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URLS = (process.env.BASE_URLS || 'https://www.chloefood.com').split(',');
const SHOP = 'https://shop.chloefood.com/';

const get = (url) => fetch(url, { redirect: 'manual' });

for (const base of BASE_URLS) {
  test(`${base}/ -> 307 to the shop catalog`, async () => {
    const res = await get(`${base}/`);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('location'), SHOP);
  });

  test(`${base}/?utm_* keeps the query string once`, async () => {
    const qs = '?utm_source=whatsapp&utm_campaign=promo&fbclid=abc';
    const res = await get(`${base}/${qs}`);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get('location'), SHOP + qs);
  });

  test(`${base}/decouvrir serves the landing with its canonical`, async () => {
    const res = await get(`${base}/decouvrir`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.chloefood\.com\/decouvrir">/);
  });

  test(`${base} deep paths are not redirected`, async () => {
    for (const path of ['/index.html', '/some/deep/link?x=1']) {
      const res = await get(base + path);
      assert.equal(res.status, 200, path);
    }
  });

  test(`${base}/robots.txt and /sitemap.xml are served as files`, async () => {
    const robots = await get(`${base}/robots.txt`);
    assert.equal(robots.status, 200);
    assert.match(await robots.text(), /^User-agent: \*/);
    const sitemap = await get(`${base}/sitemap.xml`);
    assert.equal(sitemap.status, 200);
    assert.match(await sitemap.text(), /<loc>https:\/\/www\.chloefood\.com\/decouvrir<\/loc>/);
  });
}

test('https://chloefood.com/ reaches the shop with no loop', async () => {
  let url = 'https://chloefood.com/?utm_source=qr';
  const hops = [];
  for (let i = 0; i < 5; i++) {
    const res = await get(url);
    if (res.status < 300 || res.status >= 400) break;
    url = new URL(res.headers.get('location'), url).href;
    assert.ok(!hops.includes(url), `loop at ${url}`);
    hops.push(url);
  }
  assert.equal(url, SHOP + '?utm_source=qr');
});
