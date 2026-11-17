import assert from 'node:assert/strict';
import { sitemapXml, robotsTxt } from '../src/site/medicao.js';

const E = 'https://radarsaltense.com.br/';
const xml = sitemapXml(['index.html', 'camara.html', 'vereador/a-b.html', 'camara.html'], E, '2026-11-16');
assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
assert.equal((xml.match(/<url>/g) || []).length, 3, 'uma <url> por página, sem repetir');
assert.ok(xml.includes(`<loc>${E}</loc>`), 'index.html vira a raiz');
assert.ok(!xml.includes('index.html'));
assert.ok(xml.includes(`<loc>${E}vereador/a-b.html</loc><lastmod>2026-11-16</lastmod>`));
assert.equal(robotsTxt(E), `User-agent: *\nAllow: /\n\nSitemap: ${E}sitemap.xml\n`);
console.log('medicao: ok');
