export default async function handler(req, res) {
  try {
    const source = 'https://raw.githubusercontent.com/marwanroouf248-svg/energy-attendants-/main/index.html';
    const r = await fetch(source, { cache: 'no-store' });
    if (!r.ok) return res.status(502).send('Failed to load app');
    let html = await r.text();
    const start = html.indexOf("else{h='<button");
    const end = html.indexOf("}$('depBtns').innerHTML=h}", start);
    if (start < 0 || end < 0) return res.status(500).send('App source pattern not found');
    let block = html.slice(start, end);
    if (!block.includes('سيلز') || !block.includes('كوتش') || !block.includes('هاوس كيبنج')) {
      return res.status(500).send('Vodafone labels not found');
    }
    // Keep the database values intact. Only change the visible department labels.
    block = block.replaceAll('>سيلز<', '>sales<').replaceAll('>كوتش<', '>coach<').replaceAll('>هاوس كيبنج<', '>House Keeping<');
    html = html.slice(0, start) + block + html.slice(end);

    // Add the creator credit globally so it appears on every screen/page of the app.
    const credit = '<div id="creator-credit" style="position:fixed;bottom:8px;left:0;right:0;text-align:center;color:#94a3b8;font-size:12px;z-index:9999;pointer-events:none">Made by Captain Marwan</div>';
    if (html.includes('</body>') && !html.includes('id="creator-credit"')) {
      html = html.replace('</body>', credit + '</body>');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send('Failed to load app');
  }
}