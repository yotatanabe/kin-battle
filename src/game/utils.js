// src/game/utils.js

export const getTeam = (p, isTeamBattle) => {
  if (!isTeamBattle) return p;
  if (p === 1 || p === 2) return 1;
  if (p === 3 || p === 4) return 2;
  return 0; 
};

export const isAlly = (p1, p2, isTeamBattle) => {
  if (p1 === 0 || p2 === 0) return false;
  return getTeam(p1, isTeamBattle) === getTeam(p2, isTeamBattle);
};

export const isEnemy = (p1, p2, isTeamBattle) => {
  if (p1 === 0 || p2 === 0) return true; 
  return getTeam(p1, isTeamBattle) !== getTeam(p2, isTeamBattle);
};

export const generateWeather = () => { 
  const r = Math.random(); 
  if (r < 0.2) return 'tachycardia'; 
  if (r < 0.4) return 'fever'; 
  return 'normal'; 
};

export const getWeatherName = (weather) => { 
  if (weather === 'tachycardia') return '頻脈 (血流ロス増大)'; 
  if (weather === 'fever') return '発熱 (Lv1組織ダメージ)'; 
  return '平熱 (安定)'; 
};

export const getWeatherDesc = (weather) => {
  if (weather === 'tachycardia') return '血流が激しくなり、遠隔モード(2マス移動)での移動ロスが大幅に増加します。';
  if (weather === 'fever') return '免疫が活性化し、膜レベル1の弱い組織にいる菌が毎期ダメージを受け減少します。';
  return '生体反応は安定しています。';
};

export const intersects = (a, b, c, d) => {
  const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  if (a.x === c.x && a.y === c.y) return false; 
  if (a.x === d.x && a.y === d.y) return false; 
  if (b.x === c.x && b.y === c.y) return false; 
  if (b.x === d.x && b.y === d.y) return false;
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
};

export const getDistance = (n1, n2) => Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));

export const canMove = (id1, id2, edges, cutEdges = [], ignoreOneWay = false) => {
  return edges.some(e => {
    const isCut = cutEdges.some(ce => (ce.s === e.s && ce.t === e.t) || (ce.s === e.t && ce.t === e.s));
    if (isCut) return false;
    if (e.isOneWay && !ignoreOneWay) return e.s === id1 && e.t === id2;
    return (e.s === id1 && e.t === id2) || (e.s === id2 && e.t === id1);
  });
};

export const getHopDistance = (id1, id2, edges, cutEdges = [], ignoreOneWay = false) => {
  if (id1 === id2) return 0;
  if (canMove(id1, id2, edges, cutEdges, ignoreOneWay)) return 1;
  const neighbors = [];
  edges.forEach(e => {
    const isCut = cutEdges.some(ce => (ce.s === e.s && ce.t === e.t) || (ce.s === e.t && ce.t === e.s));
    if (isCut) return;
    if (e.s === id1) neighbors.push(e.t);
    else if (e.t === id1 && (!e.isOneWay || ignoreOneWay)) neighbors.push(e.s);
  });
  for (const n of neighbors) { if (canMove(n, id2, edges, cutEdges, ignoreOneWay)) return 2; }
  return Infinity;
};

export const getTargetableNodes = (startId, nodes, edges, maxHops, ignoreOneWay = false) => {
  return nodes.filter(n => n.id !== startId && getHopDistance(startId, n.id, edges, [], ignoreOneWay) <= maxHops);
};

export const getVisibleNodes = (playerId, nodes, edges, isTeamBattle) => {
  const visible = new Set();
  nodes.forEach(n => {
    if (n.type === 'base') {
      visible.add(n.id);
    }
    if (n.owner === playerId || (isTeamBattle && isAlly(n.owner, playerId, isTeamBattle))) {
      visible.add(n.id);
      const neighbors1 = new Set();
      edges.forEach(e => { if (e.s === n.id) neighbors1.add(e.t); if (e.t === n.id) neighbors1.add(e.s); });
      neighbors1.forEach(neighborId => visible.add(neighborId));
      if (n.mode === 'long_range') {
        neighbors1.forEach(neighborId => { edges.forEach(e => { if (e.s === neighborId) visible.add(e.t); if (e.t === neighborId) visible.add(e.s); }); });
      }
    }
  });
  return visible;
};

export const getLossRate = (level, weather) => {
  let rate = 0;
  if (level === 1) rate = 0.5; else if (level === 2) rate = 0.3; else if (level === 3) rate = 0.1; else if (level >= 4) rate = 0;
  if (weather === 'tachycardia') rate = Math.min(0.9, rate + 0.4); 
  return rate;
};

export const getLevelName = (level) => { 
  if (level === 1) return '初期コロニー'; 
  if (level === 2) return '増殖コロニー'; 
  if (level === 3) return '活性コロニー'; 
  if (level === 4) return '超活性コロニー'; 
  return ''; 
};