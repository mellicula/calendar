export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({error: 'Missing URL parameter' });
  }

  try  {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch file');
    
    const text = await response.text();
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }

} 
