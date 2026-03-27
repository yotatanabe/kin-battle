// Vercel Serverless Function: ここは裏側サーバーなので、ブラウザからは見えません！
export default async function handler(req, res) {
  // POST通信以外は弾く
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // React（フロント）から送られてきたプロンプトを受け取る
  const { promptText } = req.body;

  // Vercelの管理画面に登録した秘密のAPIキーを読み込む（ブラウザにはバレない）
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY_SECRET;

  try {
    // ▼ ここを変更！モデル名を最新の gemini-3.1-flash-lite-preview にしました
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // AIの返答だけをReact（フロント）に返す
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
  }
}