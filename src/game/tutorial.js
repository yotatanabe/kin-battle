// src/game/tutorial.js
import { generateCpuCommands } from './engine';

// ↓この「export const TUTORIAL_SLIDES = 」が抜けていると今回のエラーが出ます！
export const TUTORIAL_SLIDES = [
  { title: "🦠 菌バトル", icon: "🫀", content: "あなたは人体に侵入した「新種の病原菌」だ。他の競合するバクテリア（ライバル派閥）と限られた栄養を奪い合い、宿主の身体を完全に支配すれば勝利となる。\n組織（丸い拠点）にある数字は「菌数」だ。この菌を隣接する組織に浸潤（移動）させて、領土を広げるんだ。" },
  { title: "🩸 浸潤と乱戦", icon: "➡️", content: "自分の組織をクリックして【浸潤（輸送）】を選び、送り込む菌数を決めろ。全員が行動を「確定」すると、一斉に感染拡大が始まる。\n複数の菌が同じ組織に侵入した場合、入り乱れての「大乱戦」になる。お互いの菌が削り合い、最後に残った菌がそこを占領するぞ！\n\n💡ヒント: 自分の組織をドラッグ＆ドロップすると全量を一気に送れるぞ！複数の組織へ連続して引っ張れば均等に分散できるぜ！" },
  { title: "📈 増殖強化と防衛", icon: "📈", content: "【増殖強化（設備拡張）】: 菌を消費して組織のレベルを上げる。レベル1から2へは10、2から3へは20、3から4へは30のコストがかかるぞ！最大容量と毎期の増殖量が増え、さらに遠隔移動時の血流ロスも軽減されるぜ！\n【細胞壁硬化（カット）】: 10菌を消費して血管を1ターン塞ぐ、防衛の要だ。" },
  { title: "📡 芽胞化と血流乗布", icon: "〰️", content: "「血流（遠隔）モード」に切り替えると、その組織での増殖が止まる代わりに、血流に乗って2マス先まで一気に感染を広げられる。\nただし、遠くへの移動は道中の免疫に狩られる「ロス（減衰）」が発生する。組織レベルを上げればロスは減るぜ。" },
  { title: "💀 壊死崩壊と 🧬 突然変異", icon: "💀", content: "【壊死部位（ゴミ捨て場）】は普段は栄養がないが、定期的に細胞が崩壊して「大量の栄養素（菌数）」が手に入る！\nまた、マップに現れる【プラスミド（段ボール）】を攻撃して壊すと、猛毒素や溶解酵素などの強力な「変異遺伝子（アイテム）」を獲得できるぞ。" },
  { title: "🚨 マクロファージの襲来", icon: "🚨", content: "【マクロファージ（白血球）】の貪食に気をつけろ！\n3ターンに1回、ランダムな組織に免疫細胞が襲来し、そこにいる菌数を「強制的に半分」にしてしまう。\n赤いターゲットマークが出た組織からは、事前に逃げるか、半分にされるのを覚悟で耐え忍ぶかの決断が必要だ！" },
  { title: "🤝 2vs2 混合感染（チーム戦）", icon: "🤝", content: "【チーム戦ルール】\nチーム1 (青・赤) vs チーム2 (緑・黄) の複合感染バトルだ。\n同盟菌の組織に菌を送ると、攻撃ではなく「支援（合流して回復）」になる。\n「相手チームの初期臓器（本拠地）をどちらか片方でも制圧した瞬間」に宿主の機能不全を引き起こして勝利だ！" }
];

export const PLAYABLE_TUTORIALS = [
  {
    id: 1, title: "STAGE 1: 最初の感染", message: "まずは隣の「上皮組織」に感染してみよう。\n自分の拠点（粘膜細胞）をクリックして【浸潤（輸送）】を選び、隣の拠点をクリックだ。\n送る菌数を決めたら右下の【変異確定】を押せ！\n（ドラッグ＆ドロップでも移動できるぞ）", allowedActions: ['move'],
    setup: () => ({ nodes: [{ id: 1, x: 250, y: 300, owner: 1, energy: 50, maxEnergy: 100, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }, { id: 2, x: 650, y: 300, owner: 0, energy: 10, maxEnergy: 50, generation: 5, type: 'normal', shobaType: 'epithelium', level: 1, mode: 'normal' }], edges: [{ s: 1, t: 2, isOneWay: false }], playerCount: 1, isTeamBattle: false }),
    cpuLogic: () => [], checkWin: (state) => state.nodes.find(n => n.id === 2)?.owner === 1
  },
  {
    id: 2, title: "STAGE 2: 増殖強化と防衛", message: "敵が攻めてきている！\n経路を【壁硬化】で1ターン塞ぎつつ、自分の組織を【増殖強化】してレベルを上げよう。\n増殖量が増えれば反撃のチャンスだ。敵を全滅させろ！", allowedActions: ['move', 'upgrade', 'cut'],
    setup: () => ({ 
      nodes: [
        { id: 1, x: 150, y: 300, owner: 1, energy: 40, maxEnergy: 100, generation: 5, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }, 
        { id: 2, x: 450, y: 300, owner: 0, energy: 5, maxEnergy: 50, generation: 5, type: 'normal', shobaType: 'epithelium', level: 1, mode: 'normal' },
        { id: 3, x: 750, y: 300, owner: 2, energy: 60, maxEnergy: 100, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }
      ], 
      edges: [{ s: 1, t: 2, isOneWay: false }, { s: 2, t: 3, isOneWay: false }], 
      playerCount: 2, isTeamBattle: false 
    }),
    cpuLogic: (state) => {
      const enemyNode = state.nodes.find(n => n.id === 3);
      const midNode = state.nodes.find(n => n.id === 2);
      const cmds = [];
      if (enemyNode && enemyNode.owner === 2 && enemyNode.energy > 15) {
         cmds.push({ type: 'move', nodeId: 3, targetId: 2, amount: 15, playerId: 2 });
      }
      if (midNode && midNode.owner === 2 && midNode.energy > 10) {
         cmds.push({ type: 'move', nodeId: 2, targetId: 1, amount: midNode.energy - 5, playerId: 2 });
      }
      return cmds;
    }, 
    checkWin: (state) => !state.alivePlayers.includes(2) && state.nodes.find(n => n.id === 3)?.owner === 1
  },
  {
    id: 3, title: "STAGE 3: 芽胞化と遠隔移動", message: "隣の組織は強固で突破できない…。\nそんな時は【モード切替】で『血流乗布(芽胞化)』を選ぼう。\n増殖が止まる代わりに、2マス先へ一気に浸潤できるぞ！奥の目標組織を占領しろ！", allowedActions: ['move', 'toggle_mode'],
    setup: () => ({ 
      nodes: [
        { id: 1, x: 150, y: 300, owner: 1, energy: 80, maxEnergy: 100, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }, 
        { id: 2, x: 450, y: 300, owner: 0, energy: 500, maxEnergy: 500, generation: 0, type: 'normal', shobaType: 'muscle', level: 3, mode: 'normal' },
        { id: 3, x: 750, y: 300, owner: 0, energy: 10, maxEnergy: 50, generation: 5, type: 'normal', shobaType: 'epithelium', level: 1, mode: 'normal' }
      ], 
      edges: [{ s: 1, t: 2, isOneWay: false }, { s: 2, t: 3, isOneWay: false }], 
      playerCount: 1, isTeamBattle: false 
    }),
    cpuLogic: () => [], 
    checkWin: (state) => state.nodes.find(n => n.id === 3)?.owner === 1
  },
  {
    id: 4, title: "STAGE 4: 変異遺伝子 (アイテム)", message: "マップの📦に浸潤して壊すと、アイテムを獲得できる。\n敵は【壁硬化】で引きこもっているぞ。アイテム『溶解酵素(EMP)』を獲得し、敵組織を対象に使って壁を突破しろ！", allowedActions: ['move', 'use_chip'],
    setup: () => ({ 
      nodes: [
        { id: 1, x: 150, y: 300, owner: 1, energy: 100, maxEnergy: 150, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }, 
        { id: 2, x: 450, y: 150, owner: 0, energy: 10, maxEnergy: 10, generation: 0, type: 'item', item: 'EMP', level: 1, mode: 'normal' },
        { id: 3, x: 650, y: 300, owner: 2, energy: 30, maxEnergy: 100, generation: 5, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }
      ], 
      edges: [{ s: 1, t: 2, isOneWay: false }, { s: 1, t: 3, isOneWay: false }, { s: 2, t: 3, isOneWay: false }], 
      playerCount: 2, isTeamBattle: false 
    }),
    cpuLogic: (state) => {
      const enemyNode = state.nodes.find(n => n.id === 3);
      if (enemyNode && enemyNode.owner === 2 && enemyNode.energy >= 10) {
         return [{ type: 'cut', nodeId: 3, targetId: 1, playerId: 2 }];
      }
      return [];
    }, 
    checkWin: (state) => state.nodes.find(n => n.id === 3)?.owner === 1
  },
  {
    id: 5, title: "STAGE 5: 総合テスト", message: "最後の試練だ！敵性菌株を完全に排除しろ。\nこのステージでは『マクロファージ』が3ターンごとに襲来する。\n赤く波打つ組織からは逃げるか耐えるか選べ！生体反応の変化にも注意だ。", allowedActions: ['move', 'toggle_mode', 'upgrade', 'cut', 'use_chip'],
    setup: () => ({ 
      nodes: [
        { id: 1, x: 150, y: 300, owner: 1, energy: 60, maxEnergy: 100, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }, 
        { id: 2, x: 750, y: 300, owner: 2, energy: 60, maxEnergy: 100, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' },
        { id: 3, x: 450, y: 150, owner: 0, energy: 20, maxEnergy: 50, generation: 5, type: 'normal', shobaType: 'muscle', level: 1, mode: 'normal' },
        { id: 4, x: 450, y: 450, owner: 0, energy: 20, maxEnergy: 50, generation: 5, type: 'normal', shobaType: 'epithelium', level: 1, mode: 'normal' },
      ], 
      edges: [{ s: 1, t: 3, isOneWay: false }, { s: 1, t: 4, isOneWay: false }, { s: 2, t: 3, isOneWay: false }, { s: 2, t: 4, isOneWay: false }, { s: 3, t: 4, isOneWay: false }], 
      playerCount: 2, isTeamBattle: false 
    }),
    cpuLogic: (state) => generateCpuCommands(state, [2]), 
    checkWin: (state) => !state.alivePlayers.includes(2)
  }
];