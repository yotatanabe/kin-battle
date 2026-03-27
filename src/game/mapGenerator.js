// src/game/mapGenerator.js
import { CHIP_TYPES } from '../config/constants';
import { intersects } from './utils';

export const spawnItem = (mapData) => {
  const { nodes, edges } = mapData;
  let x, y, valid = false, attempts = 0;
  while (!valid && attempts < 100) { 
    x = 100 + Math.random() * 700; 
    y = 100 + Math.random() * 400; 
    valid = nodes.every(n => Math.sqrt(Math.pow(x - n.x, 2) + Math.pow(y - n.y, 2)) > 70); 
    attempts++; 
  }
  if (!valid) return;

  const newId = Math.max(...nodes.map(n => n.id)) + 1;
  const chipKeys = Object.keys(CHIP_TYPES);
  const itemType = chipKeys[Math.floor(Math.random() * chipKeys.length)];
  const newItem = { id: newId, x, y, owner: 0, energy: 5, maxEnergy: 5, generation: 0, type: 'item', level: 1, mode: 'normal', item: itemType };
  
  nodes.push(newItem);
  
  const potentialEdges = nodes.filter(n => n.id !== newId)
    .map(n => ({ t: n.id, dist: Math.sqrt(Math.pow(newItem.x - n.x, 2) + Math.pow(newItem.y - n.y, 2)), n }))
    .filter(e => e.dist < 250)
    .sort((a, b) => a.dist - b.dist);
  
  let connections = 0;
  for (const edge of potentialEdges) {
    if (connections >= 2) break; 
    let hasIntersection = false;
    for (const e of edges) {
      const e_n1 = nodes.find(n => n.id === e.s); 
      const e_n2 = nodes.find(n => n.id === e.t);
      if (e_n1 && e_n2 && intersects(newItem, edge.n, e_n1, e_n2)) { hasIntersection = true; break; }
    }
    if (!hasIntersection) { edges.push({ s: edge.t, t: newItem.id, isOneWay: Math.random() < 0.4 }); connections++; }
  }
};

export const generateMap = (playerCount, isTeamBattle) => {
  const nodes = [], bases = [];
  const actualPlayers = isTeamBattle ? 4 : playerCount;
  
  if (actualPlayers === 2) bases.push({ x: 150, y: 300 }, { x: 750, y: 300 });
  else if (actualPlayers === 3) bases.push({ x: 450, y: 100 }, { x: 200, y: 450 }, { x: 700, y: 450 });
  else bases.push({ x: 150, y: 150 }, { x: 150, y: 450 }, { x: 750, y: 150 }, { x: 750, y: 450 }); 

  for (let i = 1; i <= actualPlayers; i++) {
    nodes.push({ id: i, x: bases[i-1].x, y: bases[i-1].y, owner: i, energy: 100, maxEnergy: 200, generation: 10, type: 'base', shobaType: 'mucosa', level: 1, mode: 'normal' });
  }

  let idCounter = 5; 
  for (let i = 0; i < 12 + (actualPlayers * 2); i++) {
    let x, y, valid = false, attempts = 0;
    while (!valid && attempts < 200) { 
      x = 100 + Math.random() * 700; 
      y = 100 + Math.random() * 400; 
      valid = nodes.every(n => Math.sqrt(Math.pow(x - n.x, 2) + Math.pow(y - n.y, 2)) > 75); 
      attempts++; 
    }
    const isDump = i < 2; 
    let shobaType = 'epithelium', energy = 0, maxEnergy = 0, generation = 0;
    if (isDump) { 
      shobaType = 'necrosis'; energy = 10; maxEnergy = 500; generation = 0; 
    } else {
      const rand = Math.random();
      if (rand < 0.6) { shobaType = 'epithelium'; energy = Math.floor(Math.random() * 11) + 10; maxEnergy = 30; generation = 3; } 
      else if (rand < 0.9) { shobaType = 'muscle'; energy = Math.floor(Math.random() * 16) + 20; maxEnergy = 60; generation = 6; } 
      else { shobaType = 'organ'; energy = Math.floor(Math.random() * 21) + 30; maxEnergy = 100; generation = 10; }
    }
    nodes.push({ id: idCounter++, x, y, owner: 0, energy, maxEnergy, generation, type: isDump ? 'dump' : 'normal', shobaType, level: 1, mode: 'normal' });
  }

  const edges = [], potentialEdges = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      potentialEdges.push({ s: nodes[i].id, t: nodes[j].id, dist: Math.sqrt(Math.pow(nodes[i].x - nodes[j].x, 2) + Math.pow(nodes[i].y - nodes[j].y, 2)), n1: nodes[i], n2: nodes[j] });
    }
  }
  potentialEdges.sort((a, b) => a.dist - b.dist);
  
  for (const edge of potentialEdges) {
    if (edge.dist > 350) continue; 
    if (edge.dist > 150 && Math.random() < 0.4) continue;
    
    const n1Edges = edges.filter(e => e.s === edge.n1.id || e.t === edge.n1.id).length; 
    const n2Edges = edges.filter(e => e.s === edge.n2.id || e.t === edge.n2.id).length;
    if (n1Edges >= 4 || n2Edges >= 4) continue;
    
    let hasIntersection = false;
    for (const e of edges) {
      const e_n1 = nodes.find(n => n.id === e.s); 
      const e_n2 = nodes.find(n => n.id === e.t);
      if (e_n1 && e_n2 && intersects(edge.n1, edge.n2, e_n1, e_n2)) { hasIntersection = true; break; }
    }
    if (!hasIntersection) edges.push({ s: edge.s, t: edge.t, isOneWay: Math.random() < 0.25 });
  }

  const visited = new Set();
  const dfs = (id) => { 
    if (visited.has(id)) return; 
    visited.add(id); 
    edges.forEach(e => { if (e.s === id) dfs(e.t); if (e.t === id) dfs(e.s); }); 
  };
  dfs(1); 
  
  if (visited.size < nodes.length) return generateMap(actualPlayers, isTeamBattle); 
  
  const mapData = { nodes, edges }; 
  spawnItem(mapData); 
  return mapData;
};
