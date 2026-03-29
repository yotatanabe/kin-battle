// src/hooks/useGameLoop.js
import { useMemo, useEffect } from 'react';
import { drawCanvas } from '../game/renderer';
import { getHopDistance, getLossRate } from '../game/utils';

export function useGameLoop({
  canvasRef, cameraRef, bgImageRef, animRef, dragInfo,
  gameState, phase, playerCommands, myPlayerNum, 
  mapSize, uiState, hoveredNode, gameData // ★ 修正 1：ここに追加
}) {

  // ==========================================
  // 描画用の予測データを useMemo でキャッシュする
  // ==========================================
  const predictionData = useMemo(() => {
    if (!gameState || phase === 'SETUP' || phase === 'WAITING_ROOM' || phase === 'TUTORIAL_CLEAR' || phase === 'TUTORIAL_SLIDES') {
      return { predicted: [], inflows: {} };
    }
    
    // コマンドや盤面が変更された時だけ、重いコピーと計算を行う
    let predicted = JSON.parse(JSON.stringify(gameState.nodes));
    let inflows = {}; 
    predicted.forEach(n => inflows[n.id] = 0);
    
    playerCommands.forEach(cmd => {
      const node = predicted.find(n => n.id === cmd.nodeId); 
      if (!node) return;
      
      if (cmd.type === 'move') {
        node.energy -= cmd.amount; 
        let sent = cmd.amount; 
        if (playerCommands.some(c => c.type === 'use_chip' && c.chip === 'ATK_BOOST' && c.targetId === cmd.nodeId)) sent *= 2;
        
        const hops = getHopDistance(cmd.nodeId, cmd.targetId, gameState.edges, [], node.mode === 'long_range');
        inflows[cmd.targetId] += hops === 2 ? (playerCommands.some(c => c.type === 'use_chip' && c.chip === 'BOOST') ?
          sent : Math.floor(sent * (1 - getLossRate(node.level, gameState.weather)))) : sent;
      } else if (cmd.type === 'upgrade') {
        node.energy -= node.level * 10; 
      } else if (cmd.type === 'cut') {
        node.energy -= 10;
      }
    });
    return { predicted, inflows };
  }, [gameState, playerCommands, phase]);

  // ==========================================
  // 描画ループ（requestAnimationFrame）
  // ==========================================
  useEffect(() => {
    let animationFrameId;
    const render = (time) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && gameState && phase !== 'SETUP' && phase !== 'WAITING_ROOM' && phase !== 'TUTORIAL_CLEAR' && phase !== 'TUTORIAL_SLIDES') {
        const viewPlayerNum = (!gameState.alivePlayers.includes(myPlayerNum)) ? 0 : myPlayerNum;
        const getCachedPrediction = () => predictionData;
        
        drawCanvas(
          ctx, mapSize, cameraRef, bgImageRef, gameState, playerCommands, 
          viewPlayerNum, uiState, hoveredNode, animRef.current, time, phase, dragInfo, getCachedPrediction, gameData // ★ 修正 2：ここにも追加
        );
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render(performance.now());
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    phase, gameState, playerCommands, uiState, hoveredNode, myPlayerNum, mapSize, 
    predictionData, canvasRef, cameraRef, bgImageRef, animRef, dragInfo, gameData // ★ 修正 3：ここにも追加
  ]);

  return null;
}