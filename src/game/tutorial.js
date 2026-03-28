// src/game/tutorial.js
import { generateCpuCommands } from './engine';

export const TUTORIAL_SLIDES = [
  { 
    title: "🦠 菌バトル：領土拡大", 
    icon: "🫀", 
    content: "あなたは人体に侵入した「新種の病原菌」だ。\n\n今回の目的は、本拠地の破壊ではなく【領土の占有率】だ。\n誰よりも早く体内の組織を支配し、感染を広げた者が勝者となる。" 
  },
  { 
    title: "🚩 勝利の条件", 
    icon: "🏁", 
    content: "勝利へのカウントダウンは以下の通りだ：\n\n● 個人戦：【10ノード】を先に占領する\n● チーム戦：味方と合計で【15ノード】を占領する\n\n画面上の拠点を自分の色に染め上げろ！ただし、自分の【本拠地】を奪われると、その時点で即脱落となるから注意しろ。" 
  },
  { 
    title: "🩸 浸潤と占領ルール", 
    icon: "⚔️", 
    content: "組織をクリックして菌を送り込め。送り込んだ菌の数が、その組織の現在の数と【同数以上】になれば占領成功だ！\n\nピッタリの数でぶつかって菌が0になっても、攻撃側の勝利として支配権が移るぞ。緻密な計算で効率よく奪い取れ！" 
  },
  { 
    title: "📈 増殖強化（最大Lv3）", 
    icon: "📈", 
    content: "菌を消費して組織のレベルを上げろ。コストはLv1→2で10、Lv2→3で20だ。今回の限界突破は【レベル3】までだ！\nレベルが上がれば、最大容量と毎期の増殖量が増え、遠隔移動時の減衰ロスも軽減されるぞ。" 
  },
  { 
    title: "📡 芽胞化と血流乗布", 
    icon: "〰️", 
    content: "「血流（遠隔）モード」に切り替えると、その組織での増殖が止まる代わりに、血流に乗って2マス先まで一気に感染を広げられる。\n敵の本拠地を飛び越えて、背後の中立拠点をかっさらう「裏取り」戦術に有効だ。" 
  },
  { 
    title: "🚨 免疫と特殊部位", 
    icon: "🚨", 
    content: "【マクロファージ】: 3ターンに1回、菌数が多い拠点を強襲し、数を半分にする。赤いマークが出たら逃げろ！\n【壊死部位（ゴミ捨て場）】: 特定ターンに大量のエネルギーが発生するボーナス拠点だ。\n【プラスミド（段ボール）】: 壊すと強力な「変異アイテム」を獲得できるぞ。" 
  },
  { 
    title: "🤝 2vs2 チーム戦", 
    icon: "🤝", 
    content: "チーム戦では、自分と味方の占領ノード数が【合算】されるぞ。\n\n味方の拠点には自由に菌を送って支援（回復）できる。一人が敵を足止めし、もう一人が中立拠点を高速で制圧するような連携が勝利への近道だ！" 
  }
];

export const PLAYABLE_TUTORIALS = [
  // ...（ここから下の STAGE 1 〜 5 の内容は以前のままで動作します）
  {
    id: 1, title: "STAGE 1: 最初の感染", message: "まずは隣の「上皮組織」に感染してみよう。\n自分の拠点（粘膜細胞）をクリックして【浸潤（輸送）】を選び、隣の拠点をクリックだ。\n送る菌数を決めたら右下の【行動完了】を押せ！\n（ドラッグ＆ドロップでも移動できるぞ）", allowedActions: ['move'],
    setup: () => ({ nodes: [{ id: 1, x: 250, y: 300, owner: 1, energy: 50, maxEnergy: 100, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' }, { id: 2, x: 650, y: 300, owner: 0, energy: 10, maxEnergy: 50, generation: 5, type: 'normal', shobaType: 'epithelium', level: 1, mode: 'normal' }], edges: [{ s: 1, t: 2, isOneWay: false }], playerCount: 1, isTeamBattle: false }),
    cpuLogic: () => [], checkWin: (state) => state.nodes.find(n => n.id === 2)?.owner === 1
  },
  // ...（Stage 2以降もそのまま継続）
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