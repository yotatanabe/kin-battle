// src/game/renderer.js
import { MAP_W, MAP_H, COLORS, TISSUE_INFO, CHIP_TYPES } from '../config/constants';
import { getVisibleNodes, isAlly, getHopDistance, getLevelName, getTargetableNodes, getLossRate, getTeam } from './utils';

export const drawCanvas = (ctx, mapSize, cameraRef, bgImageRef, state, commands, myPlayerNum, ui, hoveredId, anim, time, currentPhase, dragInfo, calculatePrediction) => {
  if (ctx.canvas.width !== mapSize.w) ctx.canvas.width = mapSize.w;
  if (ctx.canvas.height !== mapSize.h) ctx.canvas.height = mapSize.h;

  ctx.clearRect(0, 0, mapSize.w, mapSize.h);

  ctx.save();
  ctx.scale(cameraRef.current.scale, cameraRef.current.scale);
  ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

  if (bgImageRef.current && bgImageRef.current.complete) {
    ctx.drawImage(bgImageRef.current, 0, 0, MAP_W, MAP_H);
  } else {
    ctx.fillStyle = '#1e0000'; 
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
  ctx.fillStyle = 'rgba(30, 0, 0, 0.7)';
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  const visibleNodes = getVisibleNodes(myPlayerNum, state.nodes, state.edges, state.isTeamBattle);
  const { predicted, inflows } = currentPhase === 'INPUT' || currentPhase === 'WAITING_FOR_OTHERS' ? calculatePrediction() : { predicted: state.nodes, inflows: {} };

  ctx.strokeStyle = 'rgba(255,100,100,0.1)'; 
  ctx.lineWidth = 1 / cameraRef.current.scale;
  for(let i=0; i<=MAP_W; i+=50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,MAP_H); ctx.stroke(); }
  for(let i=0; i<=MAP_H; i+=50) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(MAP_W,i); ctx.stroke(); }

  ctx.globalCompositeOperation = 'destination-out';
  if (state.alivePlayers.includes(myPlayerNum)) {
    state.nodes.forEach(node => {
      if (visibleNodes.has(node.id)) {
        ctx.beginPath();
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 160);
        grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.5, 'rgba(0,0,0,0.8)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.arc(node.x, node.y, 160, 0, Math.PI * 2); ctx.fill();
      }
    });
  } else { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, MAP_W, MAP_H); }
  ctx.globalCompositeOperation = 'source-over';

  const drawStrokedText = (text, x, y, fillStyle, baseFontSize = 20) => {
    const s = cameraRef.current.scale;
    ctx.font = `bold ${baseFontSize / s}px sans-serif`;
    ctx.strokeStyle = '#300000'; ctx.lineWidth = 4 / s;
    ctx.strokeText(text, x, y); ctx.fillStyle = fillStyle; ctx.fillText(text, x, y);
  };

  state.edges.forEach(edge => {
    const s = state.nodes.find(n => n.id === edge.s); const t = state.nodes.find(n => n.id === edge.t);
    if (!s || !t) return;
    const isVisible = visibleNodes.has(s.id) && visibleNodes.has(t.id);
    if (!isVisible && state.alivePlayers.includes(myPlayerNum)) return;
    const isCutPlanned = commands.some(c => c.type === 'cut' && ((c.nodeId === s.id && c.targetId === t.id) || (c.nodeId === t.id && c.targetId === s.id)));

    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
    if (isCutPlanned && (currentPhase === 'INPUT' || currentPhase === 'WAITING_FOR_OTHERS')) { ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4 / cameraRef.current.scale; ctx.setLineDash([10 / cameraRef.current.scale, 10 / cameraRef.current.scale]); } 
    else { ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)'; ctx.lineWidth = 5 / cameraRef.current.scale; ctx.setLineDash(edge.isOneWay ? [15 / cameraRef.current.scale, 10 / cameraRef.current.scale] : []); }
    ctx.stroke(); ctx.setLineDash([]);
    if (edge.isOneWay) {
      const midX = (s.x + t.x) / 2, midY = (s.y + t.y) / 2, angle = Math.atan2(t.y - s.y, t.x - s.x);
      const size = 12 / cameraRef.current.scale;
      ctx.save(); ctx.translate(midX, midY); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size*0.8, -size*0.8); ctx.lineTo(-size*0.5, 0); ctx.lineTo(-size*0.8, size*0.8); ctx.closePath();
      ctx.fillStyle = isCutPlanned && (currentPhase === 'INPUT' || currentPhase === 'WAITING_FOR_OTHERS') ? '#ef4444' : 'rgba(255, 100, 100, 0.6)'; ctx.fill(); ctx.restore();
    }
  });

  if (currentPhase === 'INPUT' || currentPhase === 'WAITING_FOR_OTHERS') {
    commands.forEach(cmd => {
      if (cmd.type === 'move') {
        const hasStealth = commands.some(c => c.type === 'use_chip' && c.chip === 'STEALTH' && c.targetId === cmd.nodeId);
        if (hasStealth) return; 
        const s = state.nodes.find(n => n.id === cmd.nodeId), t = state.nodes.find(n => n.id === cmd.targetId);
        if (s && t) {
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
          const hops = getHopDistance(cmd.nodeId, cmd.targetId, state.edges, [], s.mode === 'long_range');
          ctx.strokeStyle = hops === 2 ? 'rgba(192, 132, 252, 0.8)' : (isAlly(cmd.playerId, t.owner, state.isTeamBattle) ? 'rgba(34, 197, 94, 0.8)' : 'rgba(14, 165, 233, 0.8)'); 
          ctx.lineWidth = 4 / cameraRef.current.scale; ctx.setLineDash([10 / cameraRef.current.scale, 10 / cameraRef.current.scale]); ctx.lineDashOffset = -(time / 50) % 20; ctx.stroke(); ctx.setLineDash([]);
        }
      }
    });

    if (dragInfo.current?.isDragging && dragInfo.current?.type === 'node' && dragInfo.current?.wasDragged) {
      const sNode = state.nodes.find(n => n.id === dragInfo.current.sourceNodeId);
      if (sNode) {
        const { currentLx, currentLy } = dragInfo.current;
        ctx.beginPath(); ctx.moveTo(sNode.x, sNode.y); ctx.lineTo(currentLx, currentLy);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)'; 
        ctx.lineWidth = 6 / cameraRef.current.scale; ctx.setLineDash([15 / cameraRef.current.scale, 10 / cameraRef.current.scale]); ctx.lineDashOffset = -(time / 30) % 25; ctx.stroke(); ctx.setLineDash([]);
        
        const dx = currentLx - sNode.x; const dy = currentLy - sNode.y;
        const angle = Math.atan2(dy, dx);
        const size = 18 / cameraRef.current.scale;
        ctx.save(); ctx.translate(currentLx, currentLy); ctx.rotate(angle);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-size, -size*0.6); ctx.lineTo(-size, size*0.6); ctx.closePath();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.8)'; ctx.fill(); ctx.restore();
      }
    }
  }

  state.nodes.forEach(node => {
    if (!visibleNodes.has(node.id) && state.alivePlayers.includes(myPlayerNum)) return; 
    let alpha = 1;
    if (node.isCollected) {
       if (currentPhase === 'INPUT' || currentPhase === 'WAITING_FOR_OTHERS') return; 
       const p = anim.active ? anim.progress : 1; if (p > 0.85) alpha = 1 - ((p - 0.85) / 0.15); 
    }
    ctx.globalAlpha = alpha;
    const isHovered = hoveredId === node.id, isSelected = ui.nodeId === node.id;
    const predNode = predicted.find(n => n.id === node.id);
    let drawOwner = node.owner, isBlinking = false;
    if (currentPhase === 'ANIMATING' && anim.active) {
      const p = anim.progress;
      if (p > 0.6) {
        const cap = anim.data.captures.find(c => c.nodeId === node.id), isItemCap = anim.data.items.some(i => i.x === node.x && i.y === node.y);
        if (cap) { drawOwner = cap.newOwner; if (p < 0.85) isBlinking = Math.floor(time / 80) % 2 === 0; } 
        else if (isItemCap && p < 0.85) { isBlinking = Math.floor(time / 80) % 2 === 0; }
      }
    }
    const r = node.shobaType && TISSUE_INFO[node.shobaType] ? TISSUE_INFO[node.shobaType].radius : 25;

    const pulse = 1 + Math.sin(time / 200 + node.id) * 0.05;
    const currentR = r * (node.mode === 'normal' ? pulse : 1);

    // ▼ ギザギザの形を描く処理 ▼
    const drawNodePath = () => {
      ctx.beginPath();
      if (node.type === 'dump') {
        const spikes = 10; // トゲの数
        const outerR = currentR * 1.2;
        const innerR = currentR * 0.8;
        for (let i = 0; i < spikes * 2; i++) {
          const radius = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI * i) / spikes;
          if (i === 0) ctx.moveTo(node.x + Math.cos(angle) * radius, node.y + Math.sin(angle) * radius);
          else ctx.lineTo(node.x + Math.cos(angle) * radius, node.y + Math.sin(angle) * radius);
        }
        ctx.closePath();
      } else {
        ctx.arc(node.x, node.y, currentR, 0, Math.PI * 2);
      }
    };

    drawNodePath();
    ctx.fillStyle = isBlinking ? '#ffffff' : `${COLORS.players[drawOwner]}88`; 
    ctx.fill();

    const s = cameraRef.current.scale;
    if (node.level > 1 && node.type !== 'dump' && node.type !== 'item') {
        for (let l = 2; l <= node.level; l++) {
            ctx.beginPath(); 
            ctx.arc(node.x, node.y, currentR + (l - 1) * 6 / s, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(16, 185, 129, ${0.3 + l * 0.15})`;
            ctx.lineWidth = 2 / s;
            ctx.stroke();
        }
    }

    if (node.mode === 'long_range') { ctx.beginPath(); ctx.arc(node.x, node.y, currentR + 7, 0, Math.PI * 2); ctx.strokeStyle = COLORS.long_range; ctx.lineWidth = 2 / cameraRef.current.scale; ctx.setLineDash([5 / cameraRef.current.scale, 5 / cameraRef.current.scale]); ctx.stroke(); ctx.setLineDash([]); }

    if (state.immuneTargets && state.immuneTargets.includes(node.id) && (currentPhase === 'INPUT' || currentPhase === 'WAITING_FOR_OTHERS')) {
       ctx.beginPath(); ctx.arc(node.x, node.y, currentR + 15, 0, Math.PI * 2);
       ctx.fillStyle = `rgba(239, 68, 68, ${0.2 + Math.abs(Math.sin(time / 150)) * 0.3})`;
       ctx.fill();
    }

    drawNodePath(); // 枠線を引くために形を再セット
    ctx.lineWidth = (isSelected ? 4 : isHovered ? 2 : 2) / cameraRef.current.scale; 
    ctx.strokeStyle = isSelected ? COLORS.highlight : COLORS.players[drawOwner]; 
    ctx.stroke();
    // ▲ ギザギザ処理ここまで ▲
    
    ctx.font = `${currentR * 1.2 / s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const emoji = node.type === 'item' ? '📦' : (TISSUE_INFO[node.shobaType]?.icon || '🦠');
    ctx.fillText(emoji, node.x, node.y);

    const badgeX = node.x + currentR * 0.7;
    const badgeY = node.y + currentR * 0.7;
    const isMyNode = node.owner === myPlayerNum || (state.isTeamBattle && getTeam(node.owner, true) === getTeam(myPlayerNum, true));
    const text = isMyNode && node.type !== 'item' ? `${node.energy}/${node.maxEnergy}` : `${node.energy}`;
    
    ctx.font = `bold ${11/s}px sans-serif`;
    const tw = ctx.measureText(text).width;
    const bw = Math.max(26/s, tw + 12/s);
    const bh = 18/s;
    const r_bg = 9/s;
    
    ctx.beginPath();
    ctx.moveTo(badgeX - bw/2 + r_bg, badgeY - bh/2);
    ctx.lineTo(badgeX + bw/2 - r_bg, badgeY - bh/2);
    ctx.quadraticCurveTo(badgeX + bw/2, badgeY - bh/2, badgeX + bw/2, badgeY - bh/2 + r_bg);
    ctx.lineTo(badgeX + bw/2, badgeY + bh/2 - r_bg);
    ctx.quadraticCurveTo(badgeX + bw/2, badgeY + bh/2, badgeX + bw/2 - r_bg, badgeY + bh/2);
    ctx.lineTo(badgeX - bw/2 + r_bg, badgeY + bh/2);
    ctx.quadraticCurveTo(badgeX - bw/2, badgeY + bh/2, badgeX - bw/2, badgeY + bh/2 - r_bg);
    ctx.lineTo(badgeX - bw/2, badgeY - bh/2 + r_bg);
    ctx.quadraticCurveTo(badgeX - bw/2, badgeY - bh/2, badgeX - bw/2 + r_bg, badgeY - bh/2);
    ctx.closePath();

    ctx.fillStyle = '#0f172a'; ctx.fill(); 
    ctx.lineWidth = 2 / s; ctx.strokeStyle = COLORS.players[drawOwner] || '#fff'; ctx.stroke();
    
    ctx.fillStyle = '#ffffff'; ctx.fillText(text, badgeX, badgeY);

    if (node.level > 1 && node.type !== 'dump' && node.type !== 'item') {
        const bx = node.x - currentR * 0.7;
        const by = node.y + currentR * 0.7;
        const badgeSize = 14 / s;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3 + Math.PI / 6;
            ctx.lineTo(bx + badgeSize * Math.cos(angle), by + badgeSize * Math.sin(angle));
        }
        ctx.closePath();
        const lvColors = {1: '#475569', 2: '#10b981', 3: '#3b82f6', 4: '#8b5cf6'};
        ctx.fillStyle = lvColors[node.level] || '#475569';
        ctx.fill();
        ctx.lineWidth = 2 / s;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${10/s}px sans-serif`;
        ctx.fillText(`Lv${node.level}`, bx, by);
    }

    let title = node.type === 'item' ? 'プラスミド' : TISSUE_INFO[node.shobaType]?.name || '';
    if (node.level > 1 && node.type !== 'dump' && node.type !== 'item') title = `Lv.${node.level} ${getLevelName(node.level)}`;
    if (title) {
      ctx.font = `${10/s}px sans-serif`;
      const textWidth = ctx.measureText(title).width;
      ctx.fillStyle = 'rgba(15,23,42,0.8)'; ctx.fillRect(node.x - textWidth/2 - 6/s, node.y - currentR - 22/s, textWidth + 12/s, 18/s);
      ctx.fillStyle = '#cbd5e1'; ctx.fillText(title, node.x, node.y - currentR - 12/s);
    }

    if ((currentPhase === 'INPUT' || currentPhase === 'WAITING_FOR_OTHERS') && state.alivePlayers.includes(myPlayerNum)) {
      const diff = (predNode ? predNode.energy : node.energy) - node.energy, inflow = inflows[node.id];
      if (diff !== 0 || inflow > 0) {
        ctx.font = `bold ${12/s}px sans-serif`;
        if (diff < 0) { ctx.fillStyle = '#ef4444'; ctx.fillText(`${diff}`, node.x + 40/s, node.y - 20/s); }
        if (inflow > 0) { ctx.fillStyle = '#38bdf8'; ctx.fillText(`+${inflow} IN`, node.x + 45/s, node.y); }
      }
    }
    ctx.globalAlpha = 1.0;
  });

  if (ui.mode === 'SELECTING_TARGET' || (dragInfo.current?.isDragging && dragInfo.current?.type === 'node')) {
    const sourceId = ui.mode === 'SELECTING_TARGET' ? ui.nodeId : dragInfo.current.sourceNodeId;
    const sNode = state.nodes.find(n => n.id === sourceId); 
    if (sNode) {
      const maxHops = (sNode.mode === 'long_range') ? 2 : 1;
      getTargetableNodes(sourceId, state.nodes, state.edges, maxHops, sNode.mode === 'long_range').forEach(n => {
        if (visibleNodes.has(n.id)) { ctx.beginPath(); ctx.arc(n.x, n.y, 40, 0, Math.PI * 2); ctx.fillStyle = 'rgba(250, 204, 21, 0.3)'; ctx.fill(); }
      });
    }
  }

  if (currentPhase === 'ANIMATING' && anim.active) {
    const p = anim.progress; 
    if (p < 0.25) {
      const popP = p / 0.2;
      if (popP <= 1.0) {
        anim.data.prep.forEach(prep => {
          const node = state.nodes.find(n => n.id === (prep.nodeId || prep.s)); if(!node || !visibleNodes.has(node.id)) return;
          ctx.globalAlpha = 1 - Math.pow(popP, 2); const yOff = -40 * popP / cameraRef.current.scale;
          if (prep.type === 'upgrade') drawStrokedText(`増殖強化!`, node.x, node.y + yOff, '#34d399');
          else if (prep.type === 'toggle') drawStrokedText(`MODE: ${prep.mode.toUpperCase()}`, node.x, node.y + yOff, '#c084fc');
          else if (prep.type === 'cut') drawStrokedText(`壁硬化!`, node.x, node.y + yOff, '#f87171');
          else if (prep.type === 'emp_block') drawStrokedText(`酵素溶解!`, node.x, node.y + yOff, '#facc15');
          else if (prep.type === 'mine_boost') drawStrokedText(`異常代謝 x2!`, node.x, node.y + yOff, '#facc15');
          else if (prep.type === 'atk_boost') drawStrokedText(`猛毒素 x2!`, node.x, node.y + yOff, '#facc15');
          else if (prep.type === 'sabotage') drawStrokedText(`抗生物質!`, node.x, node.y + yOff, '#ef4444');
          ctx.globalAlpha = 1.0;
        });
      }
    }
    const moveP = Math.max(0, Math.min(1, (p - 0.25) / 0.35)); 
    if (moveP > 0 && moveP < 1) {
      anim.data.movements.forEach(m => {
        const s = state.nodes.find(n => n.id === m.source), t = state.nodes.find(n => n.id === m.target);
        if(!s || !t || (!visibleNodes.has(s.id) && !visibleNodes.has(t.id))) return; 
        const numParticles = Math.min(m.amount, 40);
        for (let i = 0; i < numParticles; i++) {
          const delay = i * (0.6 / numParticles), particleP = (moveP - delay) / 0.4; 
          if (particleP > 0 && particleP < 1) {
            const px = s.x + (t.x - s.x) * particleP, py = s.y + (t.y - s.y) * particleP;
            const dx = t.y - s.y, dy = -(t.x - s.x), len = Math.sqrt(dx*dx + dy*dy) || 1;
            const waveAmt = Math.sin(particleP * Math.PI * 6 + i) * 6, nx = (dx/len) * waveAmt, ny = (dy/len) * waveAmt;
            ctx.beginPath(); ctx.arc(px + nx, py + ny, m.hops === 2 ? 2.5 : 4, 0, Math.PI * 2);
            ctx.fillStyle = m.hops === 2 ? '#c084fc' : COLORS.players[m.owner]; ctx.shadowBlur = 8 / cameraRef.current.scale; ctx.shadowColor = ctx.fillStyle; ctx.fill(); ctx.shadowBlur = 0;
          }
        }
        const headP = Math.max(0, Math.min(1, moveP / 0.4));
        if (headP > 0 && headP < 1) drawStrokedText(m.amount, s.x + (t.x - s.x) * headP, s.y + (t.y - s.y) * headP - 20/cameraRef.current.scale, '#fff', 14);
      });
    }
    if (p > 0.55 && p < 0.8) {
      const popP = (p - 0.55) / 0.25, easeOut = popP * (2 - popP); 
      anim.data.combats.forEach(c => {
        if (c.clashAmount > 0) {
          const node = state.nodes.find(n => n.id === c.nodeId); if(!node || !visibleNodes.has(node.id)) return;
          const numSparks = Math.min(c.clashAmount, 80); 
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; 
          for (let i = 0; i < numSparks; i++) {
            const angle = i * 137.5 * Math.PI / 180, dist = (20 + (i % 60)) * easeOut;
            ctx.beginPath(); ctx.moveTo(node.x + Math.cos(angle) * Math.max(0, dist - 15), node.y + Math.sin(angle) * Math.max(0, dist - 15));
            ctx.lineTo(node.x + Math.cos(angle) * dist, node.y + Math.sin(angle) * dist);
            ctx.lineWidth = (4 * (1 - popP)) / cameraRef.current.scale; ctx.strokeStyle = i % 2 === 0 ? `rgba(250, 204, 21, ${1 - popP})` : `rgba(255, 255, 255, ${1 - popP})`; ctx.stroke();
          }
          ctx.restore();
        }
      });
    }
    if (p > 0.6 && p < 0.85) {
      const popP = (p - 0.6) / 0.2, yOffset = (popP * -40) / cameraRef.current.scale;
      anim.data.combats.forEach(c => {
        const node = state.nodes.find(n => n.id === c.nodeId); if(!node || !visibleNodes.has(node.id)) return;
        ctx.globalAlpha = 1 - popP;
        if (c.force === 0) { drawStrokedText(`相殺!`, node.x, node.y - 30/cameraRef.current.scale + yOffset, '#94a3b8', 24); } 
        else if (c.attacker === -1) { drawStrokedText(`-${c.force}`, node.x, node.y - 30/cameraRef.current.scale + yOffset, '#ef4444', 28); } 
        else { const tColor = c.attacker === myPlayerNum ? '#22c55e' : (COLORS.players[c.attacker] || '#22c55e'); drawStrokedText(`+${c.force}`, node.x, node.y - 30/cameraRef.current.scale + yOffset, tColor, 24); }
        ctx.globalAlpha = 1.0;
      });
      anim.data.captures.forEach(cap => {
        const node = state.nodes.find(n => n.id === cap.nodeId); if(!node || !visibleNodes.has(node.id)) return;
        ctx.globalAlpha = 1 - popP; drawStrokedText(cap.newOwner === 0 ? '一掃...' : '感染支配!', node.x, node.y + 30/cameraRef.current.scale - yOffset, cap.newOwner === 0 ? '#cbd5e1' : COLORS.players[cap.newOwner], 22); ctx.globalAlpha = 1.0;
      });
    }
    if (p > 0.85) {
      const popP = (p - 0.85) / 0.15, yOffset = (popP * -30) / cameraRef.current.scale;
      anim.data.weatherDamages.forEach(w => {
        const node = state.nodes.find(n => n.id === w.nodeId); if(!node || !visibleNodes.has(node.id)) return;
        ctx.globalAlpha = 1 - popP; drawStrokedText(`発熱ダメージ -${w.amount}`, node.x, node.y - 35/cameraRef.current.scale + yOffset, '#22d3ee', 16); ctx.globalAlpha = 1.0;
      });
      anim.data.trashBonuses.forEach(b => {
        const node = state.nodes.find(n => n.id === b.nodeId); if(!node || !visibleNodes.has(node.id)) return;
        ctx.globalAlpha = 1 - popP; drawStrokedText(`細胞崩壊! +${b.amount}`, node.x, node.y - 35/cameraRef.current.scale + yOffset, '#ef4444', 20); ctx.globalAlpha = 1.0;
      });
      anim.data.mines.forEach(m => {
        const node = state.nodes.find(n => n.id === m.nodeId); if(!node || !visibleNodes.has(node.id)) return;
        ctx.globalAlpha = 1 - popP; drawStrokedText(`+${m.amount} 菌`, node.x + 40/cameraRef.current.scale, node.y + yOffset, '#4ade80', 16); ctx.globalAlpha = 1.0;
      });
      anim.data.items.forEach(itm => {
         if (itm.owner === myPlayerNum) { ctx.globalAlpha = 1 - popP; drawStrokedText(`GET: ${CHIP_TYPES[itm.item].name}`, itm.x, itm.y - 50/cameraRef.current.scale + yOffset, '#facc15', 18); ctx.globalAlpha = 1.0; }
      });
      anim.data.immuneAttacks.forEach(i => {
        const node = state.nodes.find(n => n.id === i.nodeId); if(!node || !visibleNodes.has(node.id)) return;
        ctx.globalAlpha = 1 - popP; drawStrokedText(`貪食! -${i.amount}`, node.x, node.y - 60/cameraRef.current.scale + yOffset, '#ef4444', 24); ctx.globalAlpha = 1.0;
      });
    }
  }
  ctx.restore();
};