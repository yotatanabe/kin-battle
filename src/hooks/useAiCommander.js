// src/hooks/useAiCommander.js
import { useState, useEffect, useRef } from 'react';
import { getVisibleNodes, getHopDistance } from '../game/utils';
import { generateCpuCommands } from '../game/engine';

export function useAiCommander({ phase, gameMode, gameState, myPlayerNum, gameData }) {
  // --- State ---
  const [cpuDifficulty, setCpuDifficulty] = useState('gemini'); // テストのため最初はgemini固定
  const [geminiCommands, setGeminiCommands] = useState(null);
  const [isGeminiThinking, setIsGeminiThinking] = useState(false);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // --- Refs ---
  const lastRequestedTurnRef = useRef(0); // Geminiへの多重送信ストッパー
  const lastApiCallTimeRef = useRef(0); // 429エラーを防ぐための時計（クールダウン）

  // --- Gemini CPUの裏側思考ロジック ---
  const fetchGeminiCpuCommands = async (currentState, cpuPlayerIds) => {
    setIsGeminiThinking(true);
    setGeminiCommands(null);

    // 前回のAPI呼び出しから絶対に「4.5秒」以上空ける
    const timeSinceLast = Date.now() - lastApiCallTimeRef.current;
    if (timeSinceLast < 4500) {
      await new Promise(resolve => setTimeout(resolve, 4500 - timeSinceLast));
    }
    lastApiCallTimeRef.current = Date.now();

    const visibleNodeIds = new Set();
    cpuPlayerIds.forEach(cpuId => {
      const visibleSet = getVisibleNodes(cpuId, currentState.nodes, currentState.edges, currentState.isTeamBattle);
      visibleSet.forEach(id => visibleNodeIds.add(id));
    });

    const cpuChips = {};
    cpuPlayerIds.forEach(id => { cpuChips[id] = currentState.chips[id] || []; });

    const stateSummary = {
      turn: currentState.turn, 
      isTeamBattle: currentState.isTeamBattle,
      cpuPlayers: cpuPlayerIds,
      cpuChips: cpuChips,
      nodes: currentState.nodes
        .filter(n => visibleNodeIds.has(n.id))
        .map(n => ({
          id: n.id, owner: n.owner, energy: n.energy, level: n.level, type: n.type, mode: n.mode,
          reachableTargets: currentState.nodes
            .filter(target => {
              if (!visibleNodeIds.has(target.id) || target.id === n.id) return false;
              const hops = getHopDistance(n.id, target.id, currentState.edges, [], n.mode === 'long_range');
              return hops === 1 || hops === 2;
            })
            .map(target => target.id)
        })),
      edges: currentState.edges.map(e => ({ s: e.s, t: e.t, isOneWay: e.isOneWay }))
    };

    const teamRuleText = currentState.isTeamBattle 
      ? `\n【チーム戦の特別ルール（超重要）】
現在は2対2のチーム戦です。プレイヤーID「奇数（1と3）」同士、「偶数（2と4）」同士が味方です。
- 勝利条件: チームの合計占領ノード数が「15」に達すること。
- 味方の拠点は絶対に攻撃せず、エネルギーが不足している味方拠点へ「move」で積極的に補給・支援してください。`
      : `\n【個人戦の勝利条件】
- 自身の占領ノード数が「10」に達すること。`;

    const promptText = `
あなたは、ターン制ノード制圧ストラテジーゲームの「最強のAI司令官」です。
現在の盤面を分析し、最短手数で勝利条件を達成するためのコマンドを作成してください。

担当プレイヤーID: [${cpuPlayerIds.join(', ')}]
※重要：あなたは上記すべてのIDを担当しています。各プレイヤーIDが1ターンに無駄なく行動できるように、それぞれのIDのコマンドを必ず含めて連携させてください。
${teamRuleText}

## 🎯 勝利の絶対優先順位
1. **勝利目前の確定行動**: あとわずかなノード数で勝利（個人10/チーム15）できる場合、最もエナジーが低く奪いやすい「中立ノード」や「敵ノード」へ一斉に move を行い、このターンでゲームを終わらせてください。
2. **防衛**: 自身の本拠地（type: 'base'）が陥落すると即脱落となります。敵が隣接している場合は cut や補給で死守してください。
3. **効率的な領土拡大**: 
   - エナジー消費を抑えるため、まずはエナジーの低い「中立ノード(owner:0)」を優先的に占領してください。
   - 敵の拠点を奪う場合は、防衛が手薄な（エナジーが少ない）拠点から順に狙ってください。
4. **敵の勝利阻止**: 敵（または敵チーム）の占領数が勝利目前（個人8〜9/チーム13〜14）の場合、その敵の拠点を全力で攻撃・奪取し、カウントを減らして阻止してください。
5. **内政（後方のみ）**: 前線に影響がない範囲で upgrade を行い、次ターンの増殖量を増やしてください（最大Lv3まで）。

## 📜 アクションルール
- 移動/攻撃: {"type":"move", "nodeId":元ID, "targetId":先ID, "amount":量, "playerId":担当ID}
  ※目標の現在のエナジーと同数以上を送れば占領可能です（相打ちOK）。
- 強化: {"type":"upgrade", "nodeId":ID, "playerId":担当ID} ※Lv3が上限。
- 切替: {"type":"toggle_mode", "nodeId":ID, "playerId":担当ID} ※2ホップ先を狙う際のみ使用。
- チップ: {"type":"use_chip", "chip":"チップ名", "targetId":対象ID, "playerId":担当ID}

## 🚫 禁止事項（厳守）
- 通常モードのノードは1ホップ先にしか move できません。
- long_range モードのノードだけ2ホップ先に move できます。
- 各ノードの reachableTargets に含まれない targetId への move は絶対に出力しないでください。
- toggle_mode を使ったノードは、そのターン中に move / cut / upgrade をしてはいけません。
- 同じ nodeId に対して、同一ターンに toggle_mode と move を同時に出力してはいけません。
- 到達不能な move は無効です。勝手に推測せず、reachableTargets にある候補だけを使ってください。
- move は必ず node.reachableTargets に含まれる targetId に対してのみ出力してください。
- normal モードのノードは1ホップ先だけです。
- toggle_mode を出した nodeId には、そのターン move を出してはいけません。

## ⚠️ 出力形式（厳守）
JSON配列のみを出力してください。文章や解説、マークダウン記号（\`\`\`json 等）は一切不要です。担当する各プレイヤーの行動を配列内にまとめてください。
例:[{"type":"move", "nodeId":1, "targetId":5, "amount":20, "playerId":1}, {"type":"upgrade", "nodeId":12, "playerId":3}, {"type":"move", "nodeId":8, "targetId":9, "amount":15, "playerId":3}]

【現在の戦況データ】
${JSON.stringify(stateSummary)}`;

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText })
      });
      const data = await res.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      const match = text.match(/\[.*\]/s);
      const parsed = match ? JSON.parse(match[0]) : [];
      setGeminiCommands(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      console.error("Gemini CPU Error:", e);
      setGeminiCommands(generateCpuCommands(currentState, cpuPlayerIds));
    } finally {
      setIsGeminiThinking(false);
    }
  };

  // --- 自動思考のトリガー ---
  useEffect(() => {
    if (phase === 'INPUT' && (gameMode === 'SOLO' || gameMode === 'WATCH' || gameMode === 'HOST') && cpuDifficulty === 'gemini') {
      if (!gameState || lastRequestedTurnRef.current === gameState.turn) return;

      let cpuPlayers = [];
      if (gameMode === 'WATCH') {
        cpuPlayers = gameState.alivePlayers;
      } else if (gameMode === 'HOST') {
        cpuPlayers = (gameData?.cpuPlayers || []).filter(p => gameState.alivePlayers.includes(p));
      } else {
        cpuPlayers = gameState.alivePlayers.filter(p => p !== myPlayerNum);
      }
      
      if (cpuPlayers.length > 0) {
        lastRequestedTurnRef.current = gameState.turn; 
        fetchGeminiCpuCommands(gameState, cpuPlayers);
      }
    }
  }, [phase, gameMode, cpuDifficulty, gameState, myPlayerNum, gameData]);

  // --- 軍師アドバイス（手動トリガー） ---
  const handleAiAdvice = async () => {
    if (!gameState) return;
    
    setIsAiLoading(true); setAiAdvice(null); setShowAiPanel(true);
    lastApiCallTimeRef.current = Date.now();
    
    const visibleNodes = gameState.nodes.filter(n => getVisibleNodes(myPlayerNum, gameState.nodes, gameState.edges, gameState.isTeamBattle).has(n.id));
    const promptText = `現在ターン: ${gameState.turn}期\n生存派閥数: ${gameState.alivePlayers.length}\n自派閥の組織数: ${visibleNodes.filter(n => n.owner === myPlayerNum).length}\nあなたは人体に侵入した新種バクテリアの冷徹な軍師プラスミドです。次の一手の戦術アドバイスを3〜4行で簡潔に提供してください。病原体らしい生々しくもクールな口調でお願いします。`;
    
    try {
      const res = await fetch('/api/gemini', { 
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ promptText }) 
      });
      const data = await res.json();
      if (!res.ok) setAiAdvice("通信エラーが発生しました。"); 
      else setAiAdvice(data.candidates?.[0]?.content?.parts?.[0]?.text || "応答が空でした。"); 
    } catch (e) { 
      setAiAdvice("通信に失敗しました。"); 
    } finally { 
      setIsAiLoading(false); 
    }
  };

  // App.jsx で使うものだけを返す
  return {
    cpuDifficulty,
    setCpuDifficulty,
    geminiCommands,
    isGeminiThinking,
    aiAdvice,
    isAiLoading,
    showAiPanel,
    setShowAiPanel,
    handleAiAdvice,
    lastRequestedTurnRef // 退出時(quitGame)にリセットするため返す
  };
}