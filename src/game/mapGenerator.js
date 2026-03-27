// src/game/mapGenerator.js
import { CHIP_TYPES } from '../config/constants';
import { intersects } from './utils';

export const spawnItem = (mapData) => {
  const { nodes, edges } = mapData;
  let x, y, valid = false, attempts = 0;
  
  // 既存のノードと重ならない場所を探す
  while (!valid && attempts < 100) { 
    x = 100 + Math.random() * 700; 
    y = 100 + Math.random() * 400; 
    valid = nodes.every(n => Math.sqrt(Math.pow(x - n.x, 2) + Math.pow(y - n.y, 2)) > 70); 
    attempts++; 
  }
  if (!valid) return;

  // IDの重複を避ける
  const newId = nodes.length > 0 ? Math.max(...nodes.map(n => n.id)) + 1 : 100;
  const chipKeys = Object.keys(CHIP_TYPES);
  const selectedChip = chipKeys[Math.floor(Math.random() * chipKeys.length)];

  // engine.jsと合わせるため 'item' ではなく 'subType' を使用
  const newItem = { 
    id: newId, 
    x, y, 
    owner: 0, 
    energy: 10, 
    maxEnergy: 50, 
    generation: 0, 
    type: 'item', 
    subType: selectedChip, // ここを 'item' から 'subType' に修正
    shobaType: 'epithelium', // 拾った後のデフォルトの見た目
    level: 1, 
    mode: 'normal' 
  };
  
  nodes.push(newItem);
  
  // 近隣ノードとの接続
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
      if (e_n1 && e_n2 && intersects(newItem, edge.n, e_n1, e_n2)) { 
        hasIntersection = true; 
        break; 
      }
    }
    if (!hasIntersection) { 
      edges.push({ s: edge.t, t: newItem.id, isOneWay: Math.random() < 0.4 }); 
      connections++; 
    }
  }
};

// generateMap はそのまま（末尾で spawnItem を呼んでいるのでOK）
export const generateMap = (playerCount, isTeamBattle) => {
  // ... (既存の generateMap ロジック) ...
  // ※コードが長いため省略しますが、末尾の spawnItem(mapData) で上記修正版が呼ばれます
};
