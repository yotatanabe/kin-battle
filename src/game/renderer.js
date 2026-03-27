// src/game/renderer.js
import { MAP_W, MAP_H, COLORS, TISSUE_INFO, CHIP_TYPES } from '../config/constants';
import { getVisibleNodes, isAlly, getHopDistance, getTargetableNodes, getTeam } from './utils';

export const drawCanvas = (ctx, mapSize, cameraRef, bgImageRef, state, commands, myPlayerNum, ui, hoveredId, anim, time, currentPhase, dragInfo, calculatePrediction) => {
  ctx.canvas.width = mapSize.w; ctx.canvas.height = mapSize.h;
  ctx.clearRect(0, 0, mapSize.w, mapSize.h);

  ctx.save();
  ctx.scale(cameraRef.current.scale, cameraRef.current.scale);
  ctx.translate(-cameraRef.current.x, -cameraRef.current.y);

  if (bgImageRef.current?.complete) ctx.drawImage(bgImageRef.current, 0, 0, MAP_W, MAP_H);
  else { ctx.fillStyle = '#1e0000'; ctx.fillRect(0, 0, MAP_W, MAP_H); }
  ctx.fillStyle = 'rgba(30, 0, 0, 0.6)'; ctx.fillRect(0, 0, MAP_W, MAP_H);

  const visibleNodes = getVisibleNodes(myPlayerNum, state.nodes, state.edges, state.isTeamBattle);
  const { predicted, inflows } = (currentPhase.includes('INPUT') || currentPhase.includes('WAITING')) ? calculatePrediction() : { predicted: state.nodes, inflows: {} };

  const drawStrokedText = (text, x, y, fill, size = 20) => {
    const s = cameraRef.current.scale; ctx.font = `bold ${size / s}px sans-serif`; ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4 / s; ctx.strokeText(text, x, y); ctx.fillStyle = fill; ctx.fillText(text, x, y);
  };

  // エッジ描画
  state.edges.forEach(edge => {
    const s = state.nodes.find(n => n.id === edge.s), t = state.nodes.find(n => n.id === edge.t);
    if (!s || !t || (!visibleNodes.has(s.id) && !visibleNodes.has(t.id))) return;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.3)'; ctx.lineWidth = 3 / cameraRef.current.scale; ctx.stroke();
  });

  // 移動予測線（ステルス対応）
  if (currentPhase.includes('INPUT') || currentPhase.includes('WAITING')) {
    commands.forEach(cmd => {
      if (cmd.type === 'move') {
        const isStealth = commands.some(c => c.type === 'use_chip' && c.chip === 'STEALTH' && c.nodeId === cmd.nodeId);
        if (isStealth && cmd.playerId !== myPlayerNum) return; // 敵のステルスは隠す
        const s = state.nodes.find(n => n.id === cmd.nodeId), t = state.nodes.find(n => n.id === cmd.targetId);
        if (s && t) {
          ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = isStealth ? 'rgba(200, 200, 200, 0.5)' : 'rgba(56, 189, 248, 0.6)';
          ctx.setLineDash([10 / cameraRef.current.scale, 5 / cameraRef.current.scale]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    });
  }

  // ノード描画
  state.nodes.forEach(node => {
    if (!visibleNodes.has(node.id)) return;
    const isSelected = ui.nodeId === node.id, isHovered = hoveredId === node.id;
    const r = TISSUE_INFO[node.shobaType]?.radius || 25;
    const pulse = node.owner !== 0 ? 1 + Math.sin(time/200)*0.03 : 1;

    ctx.beginPath(); ctx.arc(node.x, node.y, r * pulse, 0, Math.PI * 2);
    ctx.fillStyle = `${COLORS.players[node.owner]}aa`; ctx.fill();
    ctx.strokeStyle = isSelected ? COLORS.highlight : COLORS.players[node.owner];
    ctx.lineWidth = (isSelected ? 4 : 2) / cameraRef.current.scale; ctx.stroke();

    ctx.font = `${r/cameraRef.current.scale}px sans-serif`; ctx.fillText(node.type === 'item' ? '📦' : TISSUE_INFO[node.shobaType].icon, node.x, node.y);
    drawStrokedText(node.energy, node.x + r, node.y + r, '#fff', 14);
  });

  // アニメーション演出
  if (anim.active) {
    const p = anim.progress;
    if (p > 0.85) {
      const popP = (p - 0.85) / 0.15, yOff = -30 * popP;
      // アイテム獲得演出
      anim.data.items.forEach(itm => {
        if (itm.owner === myPlayerNum) drawStrokedText(`${itm.icon} GET: ${itm.name}`, itm.nodeId ? state.nodes.find(n=>n.id===itm.nodeId).x : 450, 300 + yOff, '#facc15', 24);
      });
      // 免疫襲来演出
      anim.data.immuneAttacks.forEach(att => {
        const n = state.nodes.find(node => node.id === att.nodeId);
        if (n) {
          ctx.beginPath(); ctx.arc(n.x, n.y, 50 * (1+popP), 0, Math.PI*2); ctx.strokeStyle = `rgba(255,255,255,${0.5*(1-popP)})`; ctx.stroke();
          drawStrokedText(`免疫襲来! -${att.damage}`, n.x, n.y + yOff - 40, '#fff', 20);
        }
      });
    }
  }

  ctx.restore();
};
