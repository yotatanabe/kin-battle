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

  // 4. 戦闘・占領・自然増殖の計算
  next.nodes.forEach(node => {
    const nodeInflows = inflows[node.id] || {};
    const originalEnergy = node.energy;
    const originalOwner = node.owner;
    const originalTeam = getTeam(originalOwner, state.isTeamBattle);

    let defEnergy = node.energy;
    
    // 味方の流入を合流
    for(let i=1; i<=state.playerCount; i++) {
        if (node.owner !== 0 && getTeam(i, state.isTeamBattle) === originalTeam && nodeInflows[i] > 0) {
            defEnergy += nodeInflows[i];
            nodeInflows[i] = 0;
        }
    }

    let attackTeams = {};
    for(let i=1; i<=state.playerCount; i++) {
        if(nodeInflows[i] > 0) {
            const t = getTeam(i, state.isTeamBattle);
            attackTeams[t] = (attackTeams[t] || 0) + nodeInflows[i];
        }
    }

    let attackers = Object.keys(attackTeams).map(t => ({ team: parseInt(t), f: attackTeams[t] }));

    if (attackers.length === 0) {
        node.energy = Math.min(node.maxEnergy, Math.max(0, defEnergy));
        return;
    }

    attackers.sort((a, b) => b.f - a.f);
    const topAtk = attackers[0];
    const sumOthers = attackers.slice(1).reduce((s, a) => s + a.f, 0);
    const netAtkForce = topAtk.f - sumOthers;

    if (netAtkForce > defEnergy) {
        // 占領発生：最大の流入勢力の代表（IDが若い順）が所有者に
        for(let i=1; i<=state.playerCount; i++) {
          if (getTeam(i, state.isTeamBattle) === topAtk.team && nodeInflows[i] > 0) {
            node.owner = i;
            break;
          }
        }
        node.energy = Math.min(node.maxEnergy, netAtkForce - defEnergy);
        node.mode = 'normal';
        animData.captures.push({ nodeId: node.id, newOwner: node.owner });
        animData.combats.push({ nodeId: node.id, force: netAtkForce, attacker: node.owner });

	if (node.type === 'item') {
            // 1. 占領したプレイヤーのチップ配列にアイテムを追加
            if (!next.chips[node.owner]) next.chips[node.owner] = [];
            next.chips[node.owner].push(node.item);
            
            // 2. 取得されたアイテムをマップから消すためのフラグを立てる
            node.isCollected = true;
            
            // 3. アニメーション（GET!表示）用のデータを送る
            animData.items.push({ x: node.x, y: node.y, item: node.item, owner: node.owner });
        }

    } else {
        // 防衛成功
        node.energy = Math.min(node.maxEnergy, defEnergy - netAtkForce);
        animData.combats.push({ nodeId: node.id, force: netAtkForce, attacker: -1 });
    }
  });

  // 自然増殖・天候・特殊タイルの処理
  const isTrashDay = next.turn === next.nextTrashTurn;
  next.nodes.forEach(node => {
    if (node.owner !== 0 && node.mode === 'normal' && node.type !== 'item' && node.type !== 'dump') {
      if (!activeSabotages.has(node.id)) {
        let gen = node.generation; 
        if (activeMineBoosts.has(node.id)) gen *= 2;
        node.energy = Math.min(node.maxEnergy, node.energy + gen);
        if (gen > 0) animData.mines.push({ nodeId: node.id, amount: gen });
      }
    }
    // 壊死部位ボーナス
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
