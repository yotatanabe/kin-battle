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
    
    // 0. チップ（アイテム）の自動使用
    if (state.chips && state.chips[p]) {
      [...new Set(state.chips[p])].forEach(chip => {
        if (chip === 'BOOST') {
          cmds.push({ type: 'use_chip', chip, playerId: p });
        } else if (chip === 'EMP' || chip === 'SABOTAGE') {
          const strongEnemies = state.nodes.filter(n => n.owner !== p && n.owner !== 0).sort((a,b) => b.energy - a.energy);
          if (strongEnemies.length > 0) cmds.push({ type: 'use_chip', chip, targetId: strongEnemies[0].id, playerId: p });
        } else if (chip === 'MINE_BOOST' || chip === 'ATK_BOOST') {
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
      
      const adjacentEnemies = state.edges
        .filter(e => e.s === node.id || e.t === node.id)
        .map(e => e.s === node.id ? e.t : e.s)
        .map(id => state.nodes.find(n => n.id === id))
        .filter(n => n && n.owner !== p && n.owner !== 0);
        
      const maxEnemyEnergy = adjacentEnemies.length > 0 ? Math.max(...adjacentEnemies.map(e => e.energy)) : 0;
      const isFrontline = adjacentEnemies.length > 0; 
      
      const keepEnergy = isFrontline ? Math.min((node.maxEnergy || 100) * 0.5, maxEnemyEnergy * 0.5 + 10) : 0;
      let currentEnergy = node.energy;
      let availableEnergy = Math.max(0, currentEnergy - keepEnergy);
      
      return { node, targets, adjacentEnemies, maxEnemyEnergy, isFrontline, keepEnergy, currentEnergy, availableEnergy };
    });

    // 2. 防衛・カットの発動（最優先）
    nodeContexts.forEach(ctx => {
      if (ctx.isFrontline && ctx.currentEnergy >= 10 && ctx.maxEnemyEnergy > ctx.currentEnergy * 1.5) {
        const dangerEnemy = ctx.adjacentEnemies.reduce((prev, curr) => (prev.energy > curr.energy) ? prev : curr);
        cmds.push({ type: 'cut', nodeId: ctx.node.id, targetId: dangerEnemy.id, playerId: p });
        ctx.currentEnergy -= 10;
        ctx.availableEnergy = 0; 
      }
    });

    // 3. 内政・レベルアップ（後方ノード限定）
    nodeContexts.forEach(ctx => {
      if (!ctx.isFrontline && ctx.node.level < 3) {
        const upgradeCost = ctx.node.level * 10;
        if (ctx.currentEnergy >= upgradeCost + 30) {
          cmds.push({ type: 'upgrade', nodeId: ctx.node.id, playerId: p });
          ctx.currentEnergy -= upgradeCost;
          ctx.availableEnergy = 0; 
        }
      }
    });

    // 4. 補給（後方ノードから前線の味方への移動）
    nodeContexts.forEach(ctx => {
      if (!ctx.isFrontline && ctx.availableEnergy > 20) {
        let frontLineAllies = ctx.targets.filter(t => {
          if (t.owner !== p) return false;
          return state.edges.some(e => {
             const neighborId = e.s === t.id ? e.t : (e.t === t.id ? e.s : null);
             if (!neighborId) return false;
             const neighbor = state.nodes.find(n => n.id === neighborId);
             return neighbor && neighbor.owner !== p && neighbor.owner !== 0;
          });
        });

        if (frontLineAllies.length > 0) {
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
      if (!pChips) return;
      const idx = pChips.indexOf(cmd.chip);
      if (idx !== -1) {
        pChips.splice(idx, 1); 
        if (cmd.chip === 'BOOST') activeBoosts.add(cmd.playerId);
        if (cmd.chip === 'EMP') activeEmps.add(cmd.targetId); 
        if (cmd.chip === 'MINE_BOOST') { activeMineBoosts.add(cmd.targetId); animData.prep.push({ type: 'mine_boost', nodeId: cmd.targetId }); }
        if (cmd.chip === 'ATK_BOOST') { activeAtkBoosts.add(cmd.targetId); animData.prep.push({ type: 'atk_boost', nodeId: cmd.targetId }); }
        if (cmd.chip === 'SABOTAGE') { activeSabotages.add(cmd.targetId); animData.prep.push({ type: 'sabotage', nodeId: cmd.targetId }); }
      }
    }
  });

  const actionedNodes = new Set();
  let cutEdges = [];

  // 2. 特殊行動の即時支払い (Toggle, Upgrade, Cut)
  allCommands.forEach(cmd => {
    if (['toggle_mode', 'upgrade', 'cut'].includes(cmd.type)) {
      const node = next.nodes.find(n => n.id === cmd.nodeId);
      if (!node || node.owner !== cmd.playerId || actionedNodes.has(node.id)) return;

      if (cmd.type === 'toggle_mode') { 
        node.mode = node.mode === 'normal' ? 'long_range' : 'normal'; 
        actionedNodes.add(node.id); 
        animData.prep.push({ type: 'toggle', nodeId: node.id, mode: node.mode }); 
      } 
      else if (cmd.type === 'upgrade') { 
        const cost = node.level * 10;
        if (node.energy >= cost && node.level < 3) { 
          node.energy -= cost; 
          node.level += 1; node.maxEnergy += 50; node.generation += 5; 
          actionedNodes.add(node.id); 
          animData.prep.push({ type: 'upgrade', nodeId: node.id }); 
        }
      } 
      else if (cmd.type === 'cut') {
        if (node.energy >= 10) {
          node.energy -= 10;
          actionedNodes.add(node.id); 
          if (!activeEmps.has(node.id)) { 
            cutEdges.push({ s: cmd.nodeId, t: cmd.targetId }); 
            animData.prep.push({ type: 'cut', s: cmd.nodeId, t: cmd.targetId, owner: cmd.playerId }); 
          } else { 
            animData.prep.push({ type: 'emp_block', nodeId: node.id }); 
          }
        }
      }
    }
  });

  // 3. 移動計算
  let inflows = {}; 
  next.nodes.forEach(n => { inflows[n.id] = {}; for(let i=1; i<=state.playerCount; i++) inflows[n.id][i] = 0; });
  
  allCommands.forEach(cmd => { 
    if (cmd.type === 'move') { 
      const node = next.nodes.find(n => n.id === cmd.nodeId);
      if (!node || node.owner !== cmd.playerId || actionedNodes.has(node.id)) return;
      if (cmd.nodeId === cmd.targetId) return; 

      let sentAmount = Math.floor(cmd.amount); 
      if (sentAmount <= 0) return;
      sentAmount = Math.min(sentAmount, node.energy);
      if (sentAmount <= 0) return;

      node.energy -= sentAmount;

      const isIntercepted = cutEdges.some(e => 
        (e.s === cmd.nodeId && e.t === cmd.targetId) || 
        (e.s === cmd.targetId && e.t === cmd.nodeId)
      );

      if (isIntercepted) {
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

  // 4. 戦闘・占領の計算（新・高効率ルール＆貢献度による所有権判定）
  next.nodes.forEach(node => {
    const nodeInflows = inflows[node.id] || {};
    const originalEnergy = node.energy;
    const originalOwner = node.owner;

    let teamInflows = {};
    for (let i = 1; i <= state.playerCount; i++) {
      if (nodeInflows[i] > 0) {
        const t = getTeam(i, state.isTeamBattle);
        teamInflows[t] = (teamInflows[t] || 0) + nodeInflows[i];
      }
    }
    const invaderTeams = Object.keys(teamInflows).map(t => ({ team: parseInt(t), force: teamInflows[t] }));
    const totalInflow = invaderTeams.reduce((sum, inv) => sum + inv.force, 0);

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
      if (totalInflow > originalEnergy) {
        const invaderCount = invaderTeams.length;
        const costPerInvader = Math.floor(originalEnergy / invaderCount); 
        
        invaderTeams.forEach(inv => { inv.force -= costPerInvader; });
        invaderTeams.sort((a, b) => b.force - a.force);
        const top = invaderTeams[0];
        const second = invaderTeams.length > 1 ? invaderTeams[1] : { force: 0 };
        
        node.energy = Math.max(0, top.force - second.force);
        
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
        const newOwner = getTopContributor(top.team);
        if (newOwner !== 0) node.owner = newOwner;

        node.mode = 'normal';
        animData.captures.push({ nodeId: node.id, newOwner: node.owner });
        animData.combats.push({ nodeId: node.id, force: top.force, attacker: node.owner });
      } else {
        // ★修正ポイント：本拠地（base）以外でのみ、味方同士の所有権交代（下克上）を許可する！
        if (node.type !== 'base') {
          let bestAlly = originalOwner;
          let maxAllyForce = originalEnergy + (nodeInflows[originalOwner] || 0);

          for (let i = 1; i <= state.playerCount; i++) {
            if (getTeam(i, state.isTeamBattle) === ownerTeam && i !== originalOwner) {
              let force = nodeInflows[i] || 0;
              if (force > maxAllyForce) {
                bestAlly = i;
                maxAllyForce = force;
              }
            }
          }

          if (bestAlly !== originalOwner) {
            node.owner = bestAlly;
            animData.captures.push({ nodeId: node.id, newOwner: node.owner }); 
          }
        }

        const attackForce = forceArray.length > 1 ? second.force : 0;
        if (attackForce > 0) animData.combats.push({ nodeId: node.id, force: attackForce, attacker: -1 });
      }
    }
  });

  // 5. 免疫細胞（マクロファージ）の強襲
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

  next.immuneTargets = [];
  if ((next.turn + 1) % 3 === 0) {
    const playerNodes = next.nodes.filter(n => n.owner !== 0 && n.type !== 'base' && n.type !== 'dump' && n.type !== 'item');
    if (playerNodes.length > 0) {
      playerNodes.sort((a, b) => b.energy - a.energy);
      const numTargets = Math.min(playerNodes.length, Math.random() < 0.5 ? 1 : 2);
      for (let i = 0; i < numTargets; i++) next.immuneTargets.push(playerNodes[i].id);
    }
  }

  // 6. 自然増殖・ゴミ捨て場ボーナス
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

  if (state.isTeamBattle) {
    // 【チーム戦】脱落者が1人でも出たら（どちらかの本拠地が1つでも落ちたら）即決着
    if (nextAlivePlayers.length < state.playerCount) {
      next.isGameOver = true;
      
      const deadPlayer = Array.from({length: state.playerCount}, (_, i) => i + 1).find(p => !nextAlivePlayers.includes(p));
      const loserTeam = getTeam(deadPlayer, state.isTeamBattle);
      
      const winningPlayer = nextAlivePlayers.find(p => getTeam(p, state.isTeamBattle) !== loserTeam);
      next.winner = winningPlayer || null;
    }
  } else {
    // 【個人戦】自分以外の全員が脱落したら（生存者が1人以下になったら）決着
    if (nextAlivePlayers.length <= 1) {
      next.isGameOver = true;
      next.winner = nextAlivePlayers[0] || null;
    }
  }

  return { nextState: next, animData };
};