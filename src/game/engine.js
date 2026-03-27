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

export const generateCpuCommands = (state, cpuPlayers) => {
  let cmds = [];
  for (const p of cpuPlayers) {
    if (!state.alivePlayers.includes(p)) continue;
    let usedChipsCount = 0; 
    const pChips = [...state.chips[p]];
    
    const tryUseChip = (chipType, targetId, playerId) => {
      if (usedChipsCount >= 2) return false; 
      const idx = pChips.indexOf(chipType);
      if (idx !== -1 && !cmds.some(c => c.type === 'use_chip' && c.chip === chipType && c.targetId === targetId)) {
        cmds.push({ type: 'use_chip', chip: chipType, targetId, playerId, chipIdx: idx }); 
        pChips[idx] = null; 
        usedChipsCount++; 
        return true;
      }
      return false;
    };

    const myNodes = state.nodes.filter(n => n.owner === p);
    
    if (pChips.includes('MINE_BOOST')) {
      const bestMineNode = myNodes.filter(n => n.mode === 'normal').sort((a, b) => b.generation - a.generation)[0];
      if (bestMineNode) tryUseChip('MINE_BOOST', bestMineNode.id, p);
    }
    
    if (pChips.includes('SABOTAGE')) {
      const bestSabotageNode = state.nodes.filter(n => isEnemy(n.owner, p, state.isTeamBattle) && n.type !== 'item' && n.mode === 'normal').sort((a, b) => b.generation - a.generation)[0];
      if (bestSabotageNode) tryUseChip('SABOTAGE', bestSabotageNode.id, p);
    }
    
    myNodes.forEach(node => {
      if (node.energy < 10) return; 
      const ignoreOneWay = node.mode === 'long_range';
      const adjNodes = getTargetableNodes(node.id, state.nodes, state.edges, 1, ignoreOneWay);
      const dist2Nodes = getTargetableNodes(node.id, state.nodes, state.edges, 2, ignoreOneWay);
      const threats = adjNodes.filter(n => isEnemy(n.owner, p, state.isTeamBattle) && n.type !== 'item' && n.energy > node.energy + 20);
      
      if (threats.length > 0 && node.energy >= 10 && Math.random() < 0.7) {
        threats.sort((a, b) => b.energy - a.energy); 
        cmds.push({ type: 'cut', nodeId: node.id, targetId: threats[0].id, playerId: p });
        if (pChips.includes('EMP')) tryUseChip('EMP', threats[0].id, p); 
        return; 
      }
      
      const upCost = node.level * 10;
      if (node.level < 4 && node.energy >= upCost * 2 && threats.length === 0) { 
        cmds.push({ type: 'upgrade', nodeId: node.id, playerId: p }); 
        return; 
      }
      
      const hasAdjTarget = adjNodes.some(n => n.owner !== p); 
      const hasDist2Target = dist2Nodes.some(n => n.owner !== p && !adjNodes.find(an => an.id === n.id));
      
      if (node.mode === 'normal') { 
        if (!hasAdjTarget && hasDist2Target && Math.random() < 0.8) { 
          cmds.push({ type: 'toggle_mode', nodeId: node.id, playerId: p }); return; 
        } 
      } else if (node.mode === 'long_range') { 
        if (hasAdjTarget || !hasDist2Target) { 
          cmds.push({ type: 'toggle_mode', nodeId: node.id, playerId: p }); return; 
        } 
      }
      
      if (node.energy < 20) return; 
      const hops = node.mode === 'long_range' ? 2 : 1; 
      const targets = hops === 1 ? adjNodes : dist2Nodes; 
      const validTargets = targets.filter(n => n.owner !== p);

      if (validTargets.length > 0) {
        const scoredTargets = validTargets.map(t => {
          let score = 0;
          if (t.type === 'item') score += 1000; 
          else if (t.owner === 0) score += 500 - t.energy; 
          else if (isEnemy(t.owner, p, state.isTeamBattle)) {
              if (t.type === 'base') score += 800 - t.energy;
              else score += 300 - t.energy;
          } else if (isAlly(t.owner, p, state.isTeamBattle)) {
              score += 250 - t.energy; 
              if (t.type === 'base' && t.energy < 50) score += 900; 
          }
          const requiredEnergy = hops === 2 ? t.energy / (1 - getLossRate(node.level, state.weather)) : t.energy;
          if (node.energy > requiredEnergy) score += 200; 
          return { target: t, score };
        });
        
        scoredTargets.sort((a, b) => b.score - a.score); 
        const bestTarget = scoredTargets[0].target;
        
        let amount = Math.floor(node.energy * 0.5); 
        let required = bestTarget.energy + 5;
        if (hops === 2) required = Math.ceil(required / (1 - getLossRate(node.level, state.weather)));
        if (node.energy > required && required > amount) amount = required;
        
        if (pChips.includes('ATK_BOOST') && bestTarget.type !== 'item' && bestTarget.energy > amount && !isAlly(bestTarget.owner, p, state.isTeamBattle)) {
            tryUseChip('ATK_BOOST', node.id, p);
        }
        
        let isStealth = false; 
        if (pChips.includes('STEALTH') && bestTarget.owner !== 0) {
          if (tryUseChip('STEALTH', undefined, p)) isStealth = true;
        }
        
        cmds.push({ type: 'move', nodeId: node.id, targetId: bestTarget.id, amount, playerId: p, isStealth });
      }
    });
    
    if (pChips.includes('BOOST')) {
       const hasLongRangeAttack = cmds.some(c => c.type === 'move' && c.playerId === p && state.nodes.find(n=>n.id === c.nodeId)?.mode === 'long_range');
       if (hasLongRangeAttack) tryUseChip('BOOST', undefined, p);
    }
  }
  return cmds;
};

export const simulateTurn = (state, allCommands) => {
  let next = JSON.parse(JSON.stringify(state));
  let animData = { prep: [], movements: [], combats: [], mines: [], captures: [], items: [], weatherDamages: [], trashBonuses: [], immuneAttacks: [] };

  const activeBoosts = new Set(), activeEmps = new Set(), activeMineBoosts = new Set(), activeAtkBoosts = new Set(), activeSabotages = new Set();

  allCommands.forEach(cmd => {
    if (cmd.type === 'use_chip') {
      const pChips = next.chips[cmd.playerId]; const idx = pChips.indexOf(cmd.chip);
      if (idx !== -1) pChips.splice(idx, 1); 
      if (cmd.chip === 'BOOST') activeBoosts.add(cmd.playerId);
      if (cmd.chip === 'EMP') activeEmps.add(cmd.targetId); 
      if (cmd.chip === 'MINE_BOOST') { activeMineBoosts.add(cmd.targetId); animData.prep.push({ type: 'mine_boost', nodeId: cmd.targetId }); }
      if (cmd.chip === 'ATK_BOOST') { activeAtkBoosts.add(cmd.targetId); animData.prep.push({ type: 'atk_boost', nodeId: cmd.targetId }); }
      if (cmd.chip === 'SABOTAGE') { activeSabotages.add(cmd.targetId); animData.prep.push({ type: 'sabotage', nodeId: cmd.targetId }); }
    }
  });

  let cutEdges = [];
  allCommands.forEach(cmd => {
    const node = next.nodes.find(n => n.id === cmd.nodeId);
    if (!node) return;
    if (cmd.type === 'toggle_mode') { 
      node.mode = node.mode === 'normal' ? 'long_range' : 'normal'; 
      animData.prep.push({ type: 'toggle', nodeId: node.id, mode: node.mode }); 
    } 
    else if (cmd.type === 'upgrade' && node.level < 4 && node.energy >= node.level * 10) { 
      node.energy -= node.level * 10; node.level += 1; node.maxEnergy += 50; node.generation += 5; 
      animData.prep.push({ type: 'upgrade', nodeId: node.id }); 
    } 
    else if (cmd.type === 'cut' && node.energy >= 10) {
      if (!activeEmps.has(node.id)) { 
        node.energy -= 10; cutEdges.push({ s: cmd.nodeId, t: cmd.targetId }); 
        animData.prep.push({ type: 'cut', s: cmd.nodeId, t: cmd.targetId, owner: cmd.playerId }); 
      } else { 
        animData.prep.push({ type: 'emp_block', nodeId: node.id }); 
      }
    }
  });

  let inflows = {}; 
  next.nodes.forEach(n => { inflows[n.id] = {}; for(let i=1; i<=state.playerCount; i++) inflows[n.id][i] = 0; });
  
  let moveRequests = {};
  allCommands.forEach(cmd => { 
    if (cmd.type === 'move') { 
      if (!moveRequests[cmd.nodeId]) moveRequests[cmd.nodeId] = []; 
      moveRequests[cmd.nodeId].push(cmd); 
    } 
  });

  Object.keys(moveRequests).forEach(nodeId => {
    const node = next.nodes.find(n => n.id === parseInt(nodeId));
    if (!node) return;
    const reqs = moveRequests[nodeId];
    const totalReq = reqs.reduce((sum, r) => sum + r.amount, 0);
    reqs.forEach(req => {
      let sentAmount = req.amount; 
      if (totalReq > node.energy) sentAmount = Math.floor(req.amount * (node.energy / totalReq));
      node.energy -= sentAmount;
      
      let baseReceived = sentAmount; 
      if (activeAtkBoosts.has(req.nodeId)) baseReceived *= 2;
      
      const hops = getHopDistance(node.id, req.targetId, next.edges, cutEdges, node.mode === 'long_range');
      
      let receivedAmount = 0;
      if (hops === 1) { 
        receivedAmount = baseReceived; 
      } else if (hops === 2) { 
        let lossRate = activeBoosts.has(req.playerId) ? 0 : getLossRate(node.level, state.weather); 
        receivedAmount = Math.floor(baseReceived * (1 - lossRate)); 
      }
      
      if (receivedAmount > 0) { 
        inflows[req.targetId][req.playerId] += receivedAmount; 
        animData.movements.push({ source: req.nodeId, target: req.targetId, amount: receivedAmount, owner: req.playerId, hops }); 
      }
    });
  });

  next.nodes.forEach(node => {
    const nodeInflows = node.id in inflows ? inflows[node.id] : {};
    const originalEnergy = node.energy;
    const originalOwner = node.owner;
    const originalTeam = getTeam(originalOwner, state.isTeamBattle);

    let defEnergy = node.energy;
    
    for(let i=1; i<=state.playerCount; i++) {
        if (node.owner !== 0 && getTeam(i, state.isTeamBattle) === originalTeam && nodeInflows[i] > 0) {
            defEnergy += nodeInflows[i];
            nodeInflows[i] = 0;
        }
    }

    let attackTeams = {};
    let playerInflows = {};
    for(let i=1; i<=state.playerCount; i++) {
        if(nodeInflows[i] > 0) {
            const t = getTeam(i, state.isTeamBattle);
            if (!attackTeams[t]) attackTeams[t] = 0;
            const force = nodeInflows[i];
            attackTeams[t] += force;
            playerInflows[i] = force;
        }
    }

    let attackers = [];
    for (let t in attackTeams) {
        attackers.push({ t: parseInt(t), f: attackTeams[t] });
    }

    if (attackers.length === 0) {
        if (defEnergy !== originalEnergy) {
            node.energy = Math.min(node.maxEnergy, defEnergy);
            animData.combats.push({ nodeId: node.id, force: node.energy - originalEnergy, attacker: node.owner, clashAmount: 0 });
        }
        return;
    }

    attackers.sort((a, b) => b.f - a.f);
    let topAtkTeam = attackers[0].t;
    let topAtkForce = attackers[0].f;
    let sumOthers = 0;
    for(let i=1; i<attackers.length; i++) sumOthers += attackers[i].f;

    let netAtkForce = topAtkForce - sumOthers;
    let clashAmount = attackers.length > 1 ? sumOthers * 2 + 10 : 0;
    if (attackers.length === 1 && node.owner !== 0) clashAmount = topAtkForce;

    if (netAtkForce > 0) {
        let topPlayer = 1;
        let maxPForce = -1;
        for(let i=1; i<=state.playerCount; i++) {
            if (getTeam(i, state.isTeamBattle) === topAtkTeam && playerInflows[i] > maxPForce) {
                maxPForce = playerInflows[i];
                topPlayer = i;
            }
        }

        let eDiff = defEnergy - originalEnergy;
        node.energy = defEnergy - netAtkForce;

        if (node.energy <= 0 && node.type === 'item') {
             next.chips[topPlayer].push(node.item);
             animData.items.push({ x: node.x, y: node.y, item: node.item, owner: topPlayer });
             node.isCollected = true; 
             node.energy = 0;
             animData.combats.push({ nodeId: node.id, force: netAtkForce, attacker: topPlayer, clashAmount });
        } else if (node.energy < 0) {
             node.owner = topPlayer;
             node.energy = Math.abs(node.energy); 
             if (node.energy > node.maxEnergy) node.energy = node.maxEnergy;
             node.mode = 'normal';
             animData.captures.push({ nodeId: node.id, newOwner: topPlayer });
             animData.combats.push({ nodeId: node.id, force: netAtkForce, attacker: topPlayer, clashAmount });
        } else if (node.energy === 0) {
             node.owner = 0;
             node.mode = 'normal'; 
             animData.captures.push({ nodeId: node.id, newOwner: 0 });
             animData.combats.push({ nodeId: node.id, force: netAtkForce, attacker: topPlayer, clashAmount });
        } else {
             if (eDiff > 0) {
                 animData.combats.push({ nodeId: node.id, force: eDiff, attacker: node.owner, clashAmount });
             } else {
                 animData.combats.push({ nodeId: node.id, force: Math.abs(eDiff), attacker: -1, clashAmount });
             }
        }
    } else {
        let eDiff = defEnergy - originalEnergy;
        node.energy = Math.min(node.maxEnergy, defEnergy);
        if (eDiff > 0) {
            animData.combats.push({ nodeId: node.id, force: eDiff, attacker: node.owner, clashAmount });
        } else {
            animData.combats.push({ nodeId: node.id, force: 0, attacker: 0, clashAmount });
        }
    }
  });

  if (state.immuneTargets && state.immuneTargets.length > 0) {
     state.immuneTargets.forEach(targetId => {
         const node = next.nodes.find(n => n.id === targetId);
         if (node && node.owner !== 0 && node.type !== 'item') {
             const lostAmount = Math.ceil(node.energy / 2);
             node.energy -= lostAmount;
             animData.immuneAttacks.push({ nodeId: node.id, amount: lostAmount });
         }
     });
  }

  const isTrashDay = state.turn === state.nextTrashTurn;
  next.nodes.forEach(node => {
    if (state.weather === 'fever' && node.level === 1 && node.owner !== 0 && node.type !== 'item' && node.type !== 'dump') {
       const dmg = Math.min(node.energy, 5);
       if (dmg > 0) { node.energy -= dmg; animData.weatherDamages.push({ nodeId: node.id, amount: dmg }); }
    }
    if (node.owner !== 0 && node.mode === 'normal' && node.type !== 'item' && node.type !== 'dump') {
      if (!activeSabotages.has(node.id)) {
        let gen = node.generation; 
        if (activeMineBoosts.has(node.id)) gen *= 2;
        const added = Math.max(0, Math.min(node.maxEnergy - node.energy, gen));
        if (added > 0) { 
            node.energy += added; 
            animData.mines.push({ nodeId: node.id, amount: added }); 
        }
      }
    }
    if (isTrashDay && node.type === 'dump') {
       if (node.owner !== 0) {
         const added = Math.max(0, Math.min(node.maxEnergy - node.energy, 80));
         if (added > 0) { 
             node.energy += added; 
             animData.trashBonuses.push({ nodeId: node.id, amount: added }); 
         }
       }
    }
  });
  
  if (next.turn % 3 === 0) {
     const validTargets = next.nodes.filter(n => n.type !== 'item' && n.type !== 'dump' && n.owner !== 0);
     const numTargets = Math.min(3, validTargets.length);
     const shuffled = validTargets.sort(() => 0.5 - Math.random());
     next.immuneTargets = shuffled.slice(0, numTargets).map(n => n.id);
  } else {
     next.immuneTargets = [];
  }

  next.weather = state.forecast;
  next.forecast = generateWeather();
  
  if (isTrashDay) {
     next.nextTrashTurn = state.turn + Math.floor(Math.random() * 3) + 3;
  }
  
  if (next.turn % 3 === 0) spawnItem(next);

  let winner = null, isGameOver = false;

  if (state.isTeamBattle) {
    const base1 = next.nodes.find(n => n.id === 1);
    const base2 = next.nodes.find(n => n.id === 2);
    const base3 = next.nodes.find(n => n.id === 3);
    const base4 = next.nodes.find(n => n.id === 4);

    const team2Defeated = (base3 && getTeam(base3.owner, true) !== 2) || (base4 && getTeam(base4.owner, true) !== 2);
    const team1Defeated = (base1 && getTeam(base1.owner, true) !== 1) || (base2 && getTeam(base2.owner, true) !== 1);

    if (team2Defeated && !team1Defeated) { winner = 1; isGameOver = true; } 
    else if (team1Defeated && !team2Defeated) { winner = 2; isGameOver = true; } 
    else if (team1Defeated && team2Defeated) { winner = null; isGameOver = true; } 

    next.alivePlayers = [1, 2, 3, 4]; 
  } else {
    const nextAlivePlayers = [];
    for(let p=1; p<=state.playerCount; p++) {
      if (next.nodes.some(n => n.type === 'base' && n.id === p && n.owner === p)) nextAlivePlayers.push(p);
    }

    if (!nextAlivePlayers.includes(1)) isGameOver = true; 
    else if (nextAlivePlayers.length === 1 && nextAlivePlayers[0] === 1) { winner = 1; isGameOver = true; } 
    else if (nextAlivePlayers.length === 0) isGameOver = true; 
    else if (nextAlivePlayers.length === 1) { winner = nextAlivePlayers[0]; isGameOver = true; }
    
    next.alivePlayers = nextAlivePlayers;
  }

  next.winner = winner; 
  next.isGameOver = isGameOver; 
  next.turn += 1;
  
  return { nextState: next, animData };
};