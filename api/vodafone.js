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
    block = block.replaceAll('سيلز', 'sales').replaceAll('كوتش', 'coach').replaceAll('هاوس كيبنج', 'House Keeping');
    html = html.slice(0, start) + block + html.slice(end);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(html);
  } catch (e) {
    return res.status(500).send('Failed to load app');
  }
}
