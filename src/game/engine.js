// src/game/engine.js
import { CHIP_TYPES } from '../config/constants';
import { 
  getTeam, 
  isAlly, 
  isEnemy, 
  getTargetableNodes, 
  getHopDistance, 
  getLossRate, 
  generateWeather 
} from './utils';
import { spawnItem } from './mapGenerator';

/**
 * CPUプレイヤーの行動を生成するロジック（最凶アルゴリズム版）
 */
export const generateCpuCommands = (state, cpuPlayers) => {
  let cmds =[];

  for (const p of cpuPlayers) {
    if (!state.alivePlayers.includes(p)) continue;
    
    // 0. チップ（アイテム）の自動使用（持っていれば出し惜しみせず使う）
    if (state.chips && state.chips[p]) {
      // 同じ種類のチップを1ターンに複数回使わないようにSetで一意にする
      [...new Set(state.chips[p])].forEach(chip => {
        if (chip === 'BOOST') {
          cmds.push({ type: 'use_chip', chip, playerId: p });
        } else if (chip === 'EMP' || chip === 'SABOTAGE') {
          // 最もエネルギーが高い脅威となる敵拠点を狙う
          const strongEnemies = state.nodes.filter(n => n.owner !== p && n.owner !== 0).sort((a,b) => b.energy - a.energy);
          if (strongEnemies.length > 0) cmds.push({ type: 'use_chip', chip, targetId: strongEnemies[0].id, playerId: p });
        } else if (chip === 'MINE_BOOST' || chip === 'ATK_BOOST') {
          // 自分の最もエネルギーが高い拠点を強化する
          const myNodes = state.nodes.filter(n => n.owner === p).sort((a,b) => b.energy - a.energy);
          if (myNodes.length > 0) cmds.push({ type: 'use_chip', chip, targetId: myNodes[0].id, playerId: p });
        }
      });
    }

    const myNodes = state.nodes.filter(n => n.owner === p);
    
    // 1. 各自陣ノードの状況と、行動に使える「余剰エネルギー」を計算
    let nodeContexts = myNodes.map(node => {
      const hops = node.mode === 'long_range' ? 2 : 1;
      const targets = getTargetableNodes(node.id, state.nodes, state.edges, hops, node.mode === 'long_range');
      
      // 隣接する敵拠点を取得
      const adjacentEnemies = state.edges
        .filter(e => e.s === node.id || e.t === node.id)
        .map(e => e.s === node.id ? e.t : e.s)
        .map(id => state.nodes.find(n => n.id === id))
        .filter(n => n && n.owner !== p && n.owner !== 0);
        
      const maxEnemyEnergy = adjacentEnemies.length > 0 ? Math.max(...adjacentEnemies.map(e => e.energy)) : 0;
      const isFrontline = adjacentEnemies.length > 0; // 敵と隣接している「前線」か判定
      
      // 前線の場合、防衛用に最低限残すエネルギー（敵の最大エネルギーの半分＋10程度）
      const keepEnergy = isFrontline ? Math.min((node.maxEnergy || 100) * 0.5, maxEnemyEnergy * 0.5 + 10) : 0;
      
      // 現在の仮想エネルギー（コマンド生成中に消費していく）
      let currentEnergy = node.energy;
      let availableEnergy = Math.max(0, currentEnergy - keepEnergy);
      
      return { node, targets, adjacentEnemies, maxEnemyEnergy, isFrontline, keepEnergy, currentEnergy, availableEnergy };
    });

    // 2. 防衛・カットの発動（最優先）
    nodeContexts.forEach(ctx => {
      // 敵のエネルギーが自分の1.5倍以上あり、奪われるのが確実な時だけカット（遅滞戦術）
      if (ctx.isFrontline && ctx.currentEnergy >= 10 && ctx.maxEnemyEnergy > ctx.currentEnergy * 1.5) {
        const dangerEnemy = ctx.adjacentEnemies.reduce((prev, curr) => (prev.energy > curr.energy) ? prev : curr);
        cmds.push({ type: 'cut', nodeId: ctx.node.id, targetId: dangerEnemy.id, playerId: p });
        
        ctx.currentEnergy -= 10;
        ctx.availableEnergy = 0; // 防御に回すため、このターン他の行動（攻撃）は控える
      }
    });

    // 3. 内政・レベルアップ（後方ノード限定）
    nodeContexts.forEach(ctx => {
      // 周囲に敵がいない安全な場所で、レベル最大の4未満の場合
      if (!ctx.isFrontline && ctx.node.level < 4) {
        const upgradeCost = ctx.node.level * 10;
        // アップグレード後もエネルギーに十分な余裕（+30）がある場合のみ実行
        if (ctx.currentEnergy >= upgradeCost + 30) {
          cmds.push({ type: 'upgrade', nodeId: ctx.node.id, playerId: p });
          ctx.currentEnergy -= upgradeCost;
          ctx.availableEnergy = Math.max(0, ctx.currentEnergy - ctx.keepEnergy);
        }
      }
    });

    // 4. 戦闘・占領の計算（新・高効率ルール＆貢献度による所有権判定）
  next.nodes.forEach(node => {
    const nodeInflows = inflows[node.id] || {};
    const originalEnergy = node.energy;
    const originalOwner = node.owner;

    // ▼ そのノードに入ってきた各派閥（チーム）の総数を集計
    let teamInflows = {};
    for (let i = 1; i <= state.playerCount; i++) {
      if (nodeInflows[i] > 0) {
        const t = getTeam(i, state.isTeamBattle);
        teamInflows[t] = (teamInflows[t] || 0) + nodeInflows[i];
      }
    }
    const invaderTeams = Object.keys(teamInflows).map(t => ({ team: parseInt(t), force: teamInflows[t] }));
    const totalInflow = invaderTeams.reduce((sum, inv) => sum + inv.force, 0);

    // ★ 追加：特定のチーム内で「一番多く菌を出したプレイヤー」を特定する便利関数
    const getTopContributor = (targetTeam) => {
      let bestPlayer = 0;
      let maxForce = 0;
      for (let i = 1; i <= state.playerCount; i++) {
        if (getTeam(i, state.isTeamBattle) === targetTeam) {
          if ((nodeInflows[i] || 0) > maxForce) {
            bestPlayer = i;
            maxForce = nodeInflows[i];
          }
        }
      }
      return bestPlayer;
    };

    if (originalOwner === 0) {
      // ==========================================
      // パターンA：誰の縄張りでもない場合（中立）
      // ==========================================
      if (totalInflow > originalEnergy) {
        // (1) 進入総数が元の数より多い場合
        const invaderCount = invaderTeams.length;
        const costPerInvader = Math.floor(originalEnergy / invaderCount); 
        
        invaderTeams.forEach(inv => { inv.force -= costPerInvader; });
        invaderTeams.sort((a, b) => b.force - a.force);
        const top = invaderTeams[0];
        const second = invaderTeams.length > 1 ? invaderTeams[1] : { force: 0 };
        
        node.energy = Math.max(0, top.force - second.force);
        
        // ▼ 変更：占領したチームの中で、一番多く菌を出した人が新しい主になる
        const newOwner = getTopContributor(top.team);
        if (newOwner !== 0) node.owner = newOwner;
        
        node.mode = 'normal';
        animData.captures.push({ nodeId: node.id, newOwner: node.owner });
        animData.combats.push({ nodeId: node.id, force: top.force, attacker: node.owner });

        if (node.type === 'item') {
            if (!next.chips[node.owner]) next.chips[node.owner] = [];
            next.chips[node.owner].push(node.item);
            node.isCollected = true;
            animData.items.push({ x: node.x, y: node.y, item: node.item, owner: node.owner });
        }
      } else {
        node.energy = originalEnergy - totalInflow; 
        if (totalInflow > 0) animData.combats.push({ nodeId: node.id, force: totalInflow, attacker: -1 });
      }

    } else {
      // ==========================================
      // パターンB：誰かの縄張りだった場合
      // ==========================================
      const ownerTeam = getTeam(originalOwner, state.isTeamBattle);
      let forces = {};
      
      forces[ownerTeam] = originalEnergy + (teamInflows[ownerTeam] || 0);
      
      invaderTeams.forEach(inv => {
        if (inv.team !== ownerTeam) forces[inv.team] = inv.force;
      });
      
      const forceArray = Object.keys(forces).map(t => ({ team: parseInt(t), force: forces[t] }));
      forceArray.sort((a, b) => b.force - a.force);
      
      const top = forceArray[0];
      const second = forceArray.length > 1 ? forceArray[1] : { force: 0 };
      
      node.energy = Math.max(0, top.force - second.force);
      
      if (top.team !== ownerTeam) {
        // ▼ 変更：敵陣を奪ったチームの中で、一番多く菌を出した人が新しい主になる
        const newOwner = getTopContributor(top.team);
        if (newOwner !== 0) node.owner = newOwner;

        node.mode = 'normal';
        animData.captures.push({ nodeId: node.id, newOwner: node.owner });
        animData.combats.push({ nodeId: node.id, force: top.force, attacker: node.owner });
      } else {
        // ▼ 追加：防衛成功・補給時に、味方の中で「元の持ち主の貢献」を上回る菌を送った人がいれば所有権を譲る
        let bestAlly = originalOwner;
        // 元の持ち主の貢献度 ＝ (元々あったエネルギー) ＋ (自分で新しく送った分)
        let maxAllyForce = originalEnergy + (nodeInflows[originalOwner] || 0);

        for (let i = 1; i <= state.playerCount; i++) {
          if (getTeam(i, state.isTeamBattle) === ownerTeam && i !== originalOwner) {
            let force = nodeInflows[i] || 0;
            // 仲間が送った量の方が、元の持ち主の貢献度より多ければ所有権交代！
            if (force > maxAllyForce) {
              bestAlly = i;
              maxAllyForce = force;
            }
          }
        }

        if (bestAlly !== originalOwner) {
          node.owner = bestAlly;
          animData.captures.push({ nodeId: node.id, newOwner: node.owner }); // 所有権交代のアニメーション
        }

        // 防衛アニメーション
        const attackForce = forceArray.length > 1 ? second.force : 0;
        if (attackForce > 0) animData.combats.push({ nodeId: node.id, force: attackForce, attacker: -1 });
      }
    }
  });

    // 5. 補給（後方ノードから前線の味方への移動）
    nodeContexts.forEach(ctx => {
      // 後方ノードで、まだ20以上のエネルギーが余っている場合は前線に送る（マクロファージ対策にもなる）
      if (!ctx.isFrontline && ctx.availableEnergy > 20) {
        let frontLineAllies = ctx.targets.filter(t => {
          if (t.owner !== p) return false;
          // その味方ノードが前線かどうか判定
          return state.edges.some(e => {
             const neighborId = e.s === t.id ? e.t : (e.t === t.id ? e.s : null);
             if (!neighborId) return false;
             const neighbor = state.nodes.find(n => n.id === neighborId);
             return neighbor && neighbor.owner !== p && neighbor.owner !== 0;
          });
        });

        if (frontLineAllies.length > 0) {
          // 最もエネルギーが少ない前線の味方に補給して守りを固める
          frontLineAllies.sort((a, b) => a.energy - b.energy);
          const targetAlly = frontLineAllies[0];
          
          cmds.push({ type: 'move', nodeId: ctx.node.id, targetId: targetAlly.id, amount: ctx.availableEnergy, playerId: p });
          ctx.currentEnergy -= ctx.availableEnergy;
          ctx.availableEnergy = 0;
        }
      }
    });
  }
  return cmds;
};

/**
 * ターン全体のシミュレーション（戦闘・移動・増殖の計算）
 */
export const simulateTurn = (state, allCommands) => {
  let next = JSON.parse(JSON.stringify(state));
  let animData = { prep: [], movements: [], combats: [], mines: [], captures: [], items: [], weatherDamages: [], trashBonuses: [], immuneAttacks: [] };

  const activeBoosts = new Set(), activeEmps = new Set(), activeMineBoosts = new Set(), activeAtkBoosts = new Set(), activeSabotages = new Set();

  // 1. チップ効果の事前登録
  allCommands.forEach(cmd => {
    if (cmd.type === 'use_chip') {
      const pChips = next.chips[cmd.playerId];
      const idx = pChips.indexOf(cmd.chip);
      if (idx !== -1) pChips.splice(idx, 1); 
      if (cmd.chip === 'BOOST') activeBoosts.add(cmd.playerId);
      if (cmd.chip === 'EMP') activeEmps.add(cmd.targetId); 
      if (cmd.chip === 'MINE_BOOST') { activeMineBoosts.add(cmd.targetId); animData.prep.push({ type: 'mine_boost', nodeId: cmd.targetId }); }
      if (cmd.chip === 'ATK_BOOST') { activeAtkBoosts.add(cmd.targetId); animData.prep.push({ type: 'atk_boost', nodeId: cmd.targetId }); }
      if (cmd.chip === 'SABOTAGE') { activeSabotages.add(cmd.targetId); animData.prep.push({ type: 'sabotage', nodeId: cmd.targetId }); }
    }
  });

  // 2. 行動コストの即時支払い & カット(壁)の登録
  let cutEdges = [];
  allCommands.forEach(cmd => {
    const node = next.nodes.find(n => n.id === cmd.nodeId);
    if (!node) return;

    if (cmd.type === 'toggle_mode') { 
      node.mode = node.mode === 'normal' ? 'long_range' : 'normal'; 
      animData.prep.push({ type: 'toggle', nodeId: node.id, mode: node.mode }); 
    } 
    else if (cmd.type === 'upgrade') { 
      node.energy -= node.level * 10; 
      node.level += 1; node.maxEnergy += 50; node.generation += 5; 
      animData.prep.push({ type: 'upgrade', nodeId: node.id }); 
    } 
    else if (cmd.type === 'cut') {
      node.energy -= 10;
      if (!activeEmps.has(node.id)) { 
        cutEdges.push({ s: cmd.nodeId, t: cmd.targetId }); 
        animData.prep.push({ type: 'cut', s: cmd.nodeId, t: cmd.targetId, owner: cmd.playerId }); 
      } else { 
        animData.prep.push({ type: 'emp_block', nodeId: node.id }); 
      }
    }
  });

  // 3. 移動計算（カットによる撃墜ロジック適用）
  let inflows = {}; 
  next.nodes.forEach(n => { inflows[n.id] = {}; for(let i=1; i<=state.playerCount; i++) inflows[n.id][i] = 0; });
  
  allCommands.forEach(cmd => { 
    if (cmd.type === 'move') { 
      const node = next.nodes.find(n => n.id === cmd.nodeId);
      if (!node) return;

      // 移動コストの支払い
      let sentAmount = cmd.amount;
      node.energy -= sentAmount;

      // カット（壁）の判定
      const isIntercepted = cutEdges.some(e => 
        (e.s === cmd.nodeId && e.t === cmd.targetId) || 
        (e.s === cmd.targetId && e.t === cmd.nodeId)
      );

      if (isIntercepted) {
        // 壁に激突して消滅（目的地には届かない）
        animData.movements.push({ source: cmd.nodeId, target: cmd.targetId, amount: 0, owner: cmd.playerId, isIntercepted: true });
        return; 
      }
      
      let baseReceived = sentAmount; 
      if (activeAtkBoosts.has(cmd.nodeId)) baseReceived *= 2;
      
      const hops = getHopDistance(node.id, cmd.targetId, next.edges, [], node.mode === 'long_range');
      let receivedAmount = 0;
      if (hops === 1) { 
        receivedAmount = baseReceived; 
      } else if (hops === 2) { 
        let lossRate = activeBoosts.has(cmd.playerId) ? 0 : getLossRate(node.level, state.weather); 
        receivedAmount = Math.floor(baseReceived * (1 - lossRate)); 
      }
      
      if (receivedAmount > 0) { 
        inflows[cmd.targetId][cmd.playerId] += receivedAmount; 
        animData.movements.push({ source: cmd.nodeId, target: cmd.targetId, amount: receivedAmount, owner: cmd.playerId, hops }); 
      }
    } 
  });

  // 4. 戦闘・占領の計算（新・高効率ルール）
  next.nodes.forEach(node => {
    const nodeInflows = inflows[node.id] || {};
    const originalEnergy = node.energy;
    const originalOwner = node.owner;

    // ▼ そのノードに入ってきた各派閥（チーム）の総数を集計
    let teamInflows = {};
    for (let i = 1; i <= state.playerCount; i++) {
      if (nodeInflows[i] > 0) {
        const t = getTeam(i, state.isTeamBattle);
        teamInflows[t] = (teamInflows[t] || 0) + nodeInflows[i];
      }
    }
    const invaderTeams = Object.keys(teamInflows).map(t => ({ team: parseInt(t), force: teamInflows[t] }));
    const totalInflow = invaderTeams.reduce((sum, inv) => sum + inv.force, 0);

    if (originalOwner === 0) {
      // ==========================================
      // パターンA：誰の縄張りでもない場合（中立）
      // ==========================================
      if (totalInflow > originalEnergy) {
        // (1) 進入総数が元の数より多い場合
        const invaderCount = invaderTeams.length;
        const costPerInvader = Math.floor(originalEnergy / invaderCount); // 人数で割った数(余り無視)
        
        // 各自の菌から引く
        invaderTeams.forEach(inv => { inv.force -= costPerInvader; });
        
        // 戦力順に並べ替え
        invaderTeams.sort((a, b) => b.force - a.force);
        const top = invaderTeams[0];
        const second = invaderTeams.length > 1 ? invaderTeams[1] : { force: 0 };
        
        // 1番多い数から2番目を引いた数が残る
        node.energy = Math.max(0, top.force - second.force);
        
        // 1番多い人が新しい主になる
        for (let i = 1; i <= state.playerCount; i++) {
          if (getTeam(i, state.isTeamBattle) === top.team && nodeInflows[i] > 0) {
            node.owner = i;
            break;
          }
        }
        node.mode = 'normal';
        animData.captures.push({ nodeId: node.id, newOwner: node.owner });
        animData.combats.push({ nodeId: node.id, force: top.force, attacker: node.owner });

        // アイテム取得処理
        if (node.type === 'item') {
            if (!next.chips[node.owner]) next.chips[node.owner] = [];
            next.chips[node.owner].push(node.item);
            node.isCollected = true;
            animData.items.push({ x: node.x, y: node.y, item: node.item, owner: node.owner });
        }
      } else {
        // (2) 進入総数が元の数以下の場合
        node.energy = originalEnergy - totalInflow; // 元の数から来た数を引く
        // 所有者は変わらず中立のまま
        if (totalInflow > 0) animData.combats.push({ nodeId: node.id, force: totalInflow, attacker: -1 });
      }

    } else {
      // ==========================================
      // パターンB：誰かの縄張りだった場合
      // ==========================================
      const ownerTeam = getTeam(originalOwner, state.isTeamBattle);
      let forces = {};
      
      // 主の数 = 元あった数 + 主（味方）が新しく送った数
      forces[ownerTeam] = originalEnergy + (teamInflows[ownerTeam] || 0);
      
      // その他の人が送った数
      invaderTeams.forEach(inv => {
        if (inv.team !== ownerTeam) forces[inv.team] = inv.force;
      });
      
      // 勢力ごとに配列にして、多い順に並べ替え
      const forceArray = Object.keys(forces).map(t => ({ team: parseInt(t), force: forces[t] }));
      forceArray.sort((a, b) => b.force - a.force);
      
      const top = forceArray[0];
      const second = forceArray.length > 1 ? forceArray[1] : { force: 0 };
      
      // 1番多い数から2番目を引いた数が残る
      node.energy = Math.max(0, top.force - second.force);
      
      // 1位が元の主と違えば、新しい主になる（占領）
      if (top.team !== ownerTeam) {
        for (let i = 1; i <= state.playerCount; i++) {
          if (getTeam(i, state.isTeamBattle) === top.team && nodeInflows[i] > 0) {
            node.owner = i;
            break;
          }
        }
        node.mode = 'normal';
        animData.captures.push({ nodeId: node.id, newOwner: node.owner });
        animData.combats.push({ nodeId: node.id, force: top.force, attacker: node.owner });
      } else {
        // 防衛成功
        const attackForce = forceArray.length > 1 ? second.force : 0;
        if (attackForce > 0) animData.combats.push({ nodeId: node.id, force: attackForce, attacker: -1 });
      }
    }
  });

  // 5. 免疫細胞（マクロファージ）の強襲（※計算を先に実行！）
  if (state.immuneTargets && state.immuneTargets.length > 0) {
    state.immuneTargets.forEach(targetId => {
      const node = next.nodes.find(n => n.id === targetId);
      if (node && node.owner !== 0 && node.type !== 'dump' && node.type !== 'item') {
        const damage = Math.ceil(node.energy / 2);
        node.energy -= damage;
        animData.immuneAttacks.push({ nodeId: node.id, amount: damage });
      }
    });
  }

  // 免疫細胞：次ターンの標的決定
  next.immuneTargets = [];
  if ((next.turn + 1) % 3 === 0) {
    const playerNodes = next.nodes.filter(n => n.owner !== 0 && n.type !== 'base' && n.type !== 'dump' && n.type !== 'item');
    if (playerNodes.length > 0) {
      playerNodes.sort((a, b) => b.energy - a.energy);
      const numTargets = Math.min(playerNodes.length, Math.random() < 0.5 ? 1 : 2);
      for (let i = 0; i < numTargets; i++) next.immuneTargets.push(playerNodes[i].id);
    }
  }

  // 6. 自然増殖・ゴミ捨て場ボーナス（※免疫のあとに実行！）
  const isTrashDay = next.turn === next.nextTrashTurn;
  next.nodes.forEach(node => {
    if (node.owner !== 0 && node.mode === 'normal' && node.type !== 'item' && node.type !== 'dump') {
      if (!activeSabotages.has(node.id)) {
        let gen = node.generation; 
        if (activeMineBoosts.has(node.id)) gen *= 2;
        node.energy = Math.min(node.maxEnergy, node.energy + gen); // ここで増える！
        if (gen > 0) animData.mines.push({ nodeId: node.id, amount: gen });
      }
    }
    if (isTrashDay && node.type === 'dump' && node.owner !== 0) {
       node.energy = Math.min(node.maxEnergy, node.energy + 80);
       animData.trashBonuses.push({ nodeId: node.id, amount: 80 });
    }
  });

  // ターン終了処理
  next.turn += 1;
  next.weather = state.forecast;
  next.forecast = generateWeather();
  if (isTrashDay) next.nextTrashTurn = next.turn + Math.floor(Math.random() * 3) + 3;
  if (next.turn % 3 === 0) spawnItem(next);

  // 勝敗判定
  const nextAlivePlayers = [];
  for(let p=1; p<=state.playerCount; p++) {
    if (next.nodes.some(n => n.type === 'base' && n.id === p && n.owner === p)) nextAlivePlayers.push(p);
  }
  next.alivePlayers = nextAlivePlayers;
  if (nextAlivePlayers.length <= 1) {
    next.isGameOver = true;
    next.winner = nextAlivePlayers[0] || null;
  }

  return { nextState: next, animData };
};
