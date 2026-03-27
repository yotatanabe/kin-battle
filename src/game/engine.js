// src/game/engine.js
import { CHIP_TYPES } from '../config/constants';
import { getTeam, getTargetableNodes, getHopDistance, getLossRate, generateWeather } from './utils';
import { spawnItem } from './mapGenerator';

export const generateCpuCommands = (state, cpuPlayers) => {
  let cmds = [];
  for (const p of cpuPlayers) {
    if (!state.alivePlayers.includes(p)) continue;
    const myNodes = state.nodes.filter(n => n.owner === p);
    myNodes.forEach(node => {
      if (node.energy < 25) return;
      const hops = node.mode === 'long_range' ? 2 : 1;
      const targets = getTargetableNodes(node.id, state.nodes, state.edges, hops, node.mode === 'long_range');
      const enemyTargets = targets.filter(n => n.owner !== p);
      if (enemyTargets.length > 0) {
        enemyTargets.sort((a, b) => a.energy - b.energy);
        cmds.push({ type: 'move', nodeId: node.id, targetId: enemyTargets[0].id, amount: Math.floor(node.energy * 0.6), playerId: p });
      } else if (node.level < 4 && node.energy >= node.level * 30) {
        cmds.push({ type: 'upgrade', nodeId: node.id, playerId: p });
      }
    });
  }
  return cmds;
};

export const simulateTurn = (state, allCommands) => {
  let next = JSON.parse(JSON.stringify(state));
  let animData = { prep: [], movements: [], combats: [], mines: [], captures: [], items: [], weatherDamages: [], trashBonuses: [], immuneAttacks: [] };

  const activeBoosts = new Set(), activeEmps = new Set(), activeMineBoosts = new Set(), activeAtkBoosts = new Set(), activeSabotages = new Set(), activeStealths = new Set();

  // 1. チップ使用フェーズ
  allCommands.forEach(cmd => {
    if (cmd.type === 'use_chip') {
      const pChips = next.chips[cmd.playerId] || [];
      const idx = pChips.indexOf(cmd.chip);
      if (idx !== -1) {
        pChips.splice(idx, 1); 
        if (cmd.chip === 'BOOST') activeBoosts.add(cmd.playerId);
        if (cmd.chip === 'EMP') activeEmps.add(cmd.targetId); 
        if (cmd.chip === 'STEALTH') { activeStealths.add(cmd.nodeId); animData.prep.push({ type: 'stealth', nodeId: cmd.nodeId }); }
        if (cmd.chip === 'MINE_BOOST') { activeMineBoosts.add(cmd.targetId); animData.prep.push({ type: 'mine_boost', nodeId: cmd.targetId }); }
        if (cmd.chip === 'ATK_BOOST') { activeAtkBoosts.add(cmd.targetId); animData.prep.push({ type: 'atk_boost', nodeId: cmd.targetId }); }
        if (cmd.chip === 'SABOTAGE') { activeSabotages.add(cmd.targetId); animData.prep.push({ type: 'sabotage', nodeId: cmd.targetId }); }
      }
    }
  });

  // 2. 即時コスト支払い・壁設置
  let cutEdges = [];
  allCommands.forEach(cmd => {
    const node = next.nodes.find(n => n.id === cmd.nodeId);
    if (!node) return;
    if (cmd.type === 'toggle_mode') { 
      node.mode = node.mode === 'normal' ? 'long_range' : 'normal'; 
      animData.prep.push({ type: 'toggle', nodeId: node.id, mode: node.mode }); 
    } else if (cmd.type === 'upgrade') { 
      node.energy -= node.level * 15; node.level += 1; node.maxEnergy += 50; node.generation += 5; 
      animData.prep.push({ type: 'upgrade', nodeId: node.id }); 
    } else if (cmd.type === 'cut') {
      node.energy -= 10;
      if (!activeEmps.has(node.id)) { 
        cutEdges.push({ s: cmd.nodeId, t: cmd.targetId }); 
        animData.prep.push({ type: 'cut', s: cmd.nodeId, t: cmd.targetId, owner: cmd.playerId }); 
      }
    }
  });

  // 3. 移動計算
  let inflows = {}; 
  next.nodes.forEach(n => { inflows[n.id] = {}; for(let i=1; i<=state.playerCount; i++) inflows[n.id][i] = 0; });
  
  allCommands.forEach(cmd => { 
    if (cmd.type === 'move') { 
      const node = next.nodes.find(n => n.id === cmd.nodeId);
      if (!node || node.energy < cmd.amount) return;
      let sentAmount = cmd.amount; node.energy -= sentAmount;
      const isIntercepted = cutEdges.some(e => (e.s === cmd.nodeId && e.t === cmd.targetId) || (e.s === cmd.targetId && e.t === cmd.nodeId));
      if (isIntercepted) { animData.movements.push({ source: cmd.nodeId, target: cmd.targetId, amount: 0, owner: cmd.playerId, isIntercepted: true }); return; }
      
      let baseReceived = sentAmount; 
      if (activeAtkBoosts.has(cmd.nodeId)) baseReceived *= 2;
      const hops = getHopDistance(node.id, cmd.targetId, next.edges, [], node.mode === 'long_range');
      let receivedAmount = 0;
      if (hops === 1) receivedAmount = baseReceived; 
      else if (hops === 2) { 
        let lossRate = activeBoosts.has(cmd.playerId) ? 0 : getLossRate(node.level, state.weather); 
        receivedAmount = Math.floor(baseReceived * (1 - lossRate)); 
      }
      if (receivedAmount > 0) { 
        inflows[cmd.targetId][cmd.playerId] += receivedAmount; 
        animData.movements.push({ source: cmd.nodeId, target: cmd.targetId, amount: receivedAmount, owner: cmd.playerId, hops }); 
      }
    } 
  });

  // 4. 戦闘・占領・アイテム獲得
  next.nodes.forEach(node => {
    const nodeInflows = inflows[node.id] || {};
    const originalTeam = getTeam(node.owner, state.isTeamBattle);
    let defEnergy = node.energy;
    
    for(let i=1; i<=state.playerCount; i++) {
        if (node.owner !== 0 && getTeam(i, state.isTeamBattle) === originalTeam && nodeInflows[i] > 0) { defEnergy += nodeInflows[i]; nodeInflows[i] = 0; }
    }

    let attackTeams = {};
    for(let i=1; i<=state.playerCount; i++) {
        if(nodeInflows[i] > 0) { const t = getTeam(i, state.isTeamBattle); attackTeams[t] = (attackTeams[t] || 0) + nodeInflows[i]; }
    }

    let attackers = Object.keys(attackTeams).map(t => ({ team: parseInt(t), f: attackTeams[t] }));
    if (attackers.length === 0) {
        node.energy = Math.min(node.maxEnergy, Math.max(0, defEnergy));
    } else {
        attackers.sort((a, b) => b.f - a.f);
        const topAtk = attackers[0], sumOthers = attackers.slice(1).reduce((s, a) => s + a.f, 0), netAtkForce = topAtk.f - sumOthers;
        if (netAtkForce > defEnergy) {
            let newOwner = 0;
            for(let i=1; i<=state.playerCount; i++) { if (getTeam(i, state.isTeamBattle) === topAtk.team && nodeInflows[i] > 0) { newOwner = i; break; } }
            node.owner = newOwner; node.energy = Math.min(node.maxEnergy, netAtkForce - defEnergy); node.mode = 'normal';

            if (node.type === 'item') {
              const chipKey = node.subType;
              if (CHIP_TYPES[chipKey]) {
                next.chips[newOwner] = next.chips[newOwner] || []; next.chips[newOwner].push(chipKey);
                animData.items.push({ nodeId: node.id, chipKey, name: CHIP_TYPES[chipKey].name, icon: CHIP_TYPES[chipKey].icon, owner: newOwner });
              }
              node.type = 'normal'; node.subType = null;
            }
            animData.captures.push({ nodeId: node.id, newOwner: node.owner });
        } else {
            node.energy = Math.min(node.maxEnergy, defEnergy - netAtkForce);
            animData.combats.push({ nodeId: node.id, force: netAtkForce, attacker: -1 });
        }
    }
  });

  // 5. 増殖・免疫襲来
  if (next.turn > 0 && next.turn % 5 === 0) {
    for (let p = 1; p <= state.playerCount; p++) {
      const pNodes = next.nodes.filter(n => n.owner === p);
      if (pNodes.length > 0) {
        const target = pNodes[Math.floor(Math.random() * pNodes.length)];
        const dmg = Math.floor(target.energy * 0.5); target.energy -= dmg;
        animData.immuneAttacks.push({ nodeId: target.id, damage: dmg });
      }
    }
  }

  next.nodes.forEach(node => {
    if (node.owner !== 0 && node.mode === 'normal' && node.type !== 'item' && node.type !== 'dump') {
      if (!activeSabotages.has(node.id)) {
        let gen = node.generation; if (activeMineBoosts.has(node.id)) gen *= 2;
        node.energy = Math.min(node.maxEnergy, node.energy + gen);
        if (gen > 0) animData.mines.push({ nodeId: node.id, amount: gen });
      }
    }
  });

  next.turn += 1; next.weather = state.forecast; next.forecast = generateWeather();
  if (next.turn % 3 === 0) spawnItem(next);

  const alive = [];
  for(let p=1; p<=state.playerCount; p++) { if (next.nodes.some(n => n.type === 'base' && n.id === p && n.owner === p)) alive.push(p); }
  next.alivePlayers = alive;
  if (alive.length <= 1) { next.isGameOver = true; next.winner = alive[0] || null; }

  return { nextState: next, animData };
};
