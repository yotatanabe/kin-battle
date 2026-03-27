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

  // どちらのAPIにも同じデータを送るので変数化しておく
  const requestBody = JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] });
  const requestHeaders = { 'Content-Type': 'application/json' };

  try {
    // 1. まずは本命の Gemma 3 27B にリクエストを送る
    let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody
    });

    // 2. もし Gemma 3 がエラー（過負荷や制限など）だった場合の処理
    if (!response.ok) {
      console.warn('Gemma 3 27B failed. Falling back to Gemini 3.1 Flash Lite...'); // Vercelのログ用

      // Gemini 3.1 Flash Lite（予備）にリクエストを送り直す
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody
      });

      // それでもエラーなら、諦めてフロントエンドにエラーを返す
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }
    }

    // 3. 成功した場合（Gemma か Gemini どちらかの結果）
    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
  }
}