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
 * CPUプレイヤーの行動を生成するロジック
 */
export const generateCpuCommands = (state, cpuPlayers) => {
  let cmds = [];
  for (const p of cpuPlayers) {
    if (!state.alivePlayers.includes(p)) continue;
    
    const myNodes = state.nodes.filter(n => n.owner === p);
    myNodes.forEach(node => {
      // 最低限のエネルギーがない場合は行動しない
      if (node.energy < 20) return;

      const hops = node.mode === 'long_range' ? 2 : 1;
      const targets = getTargetableNodes(node.id, state.nodes, state.edges, hops, node.mode === 'long_range');
      const enemyTargets = targets.filter(n => n.owner !== p);

      if (enemyTargets.length > 0) {
        // 最も弱い敵組織を狙う
        enemyTargets.sort((a, b) => a.energy - b.energy);
        const target = enemyTargets[0];
        const amount = Math.floor(node.energy * 0.5);
        if (amount > 0) {
          cmds.push({ type: 'move', nodeId: node.id, targetId: target.id, amount, playerId: p });
        }
      } else if (node.level < 4 && node.energy >= node.level * 20) {
        // 周囲に敵がいなければ自己強化
        cmds.push({ type: 'upgrade', nodeId: node.id, playerId: p });
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
