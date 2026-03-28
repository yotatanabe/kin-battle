// src/hooks/useGameInput.js
import { useState, useRef, useEffect } from 'react';
import { getVisibleNodes, getDistance, getHopDistance, isEnemy, isAlly } from '../game/utils';
import { TISSUE_INFO, MAP_W, MAP_H } from '../config/constants';
import { PLAYABLE_TUTORIALS } from '../game/tutorial';

export function useGameInput({
  canvasRef, mapContainerRef, cameraRef, mapSize,
  gameState, phase, myPlayerNum, 
  gameModeRefCurrent, tutorialStageRefCurrent,
  playerCommands, setPlayerCommands,
  uiState, setUiState, setAmountSlider,
  selectedChip, setSelectedChip, addCommand
}) {
  const [hoveredNode, setHoveredNode] = useState(null);
  const dragInfo = useRef({ isDragging: false, wasDragged: false, type: 'none', startX: 0, startY: 0, startCamX: 0, startCamY: 0, sourceNodeId: null, currentLx: 0, currentLy: 0 });
  const touchInfo = useRef({ mode: 'none', initialDist: 0, startScale: 1, startCamX: 0, startCamY: 0, vx: 0, vy: 0 });

  const resetCamera = () => {
    if (!mapContainerRef.current) return;
    const cw = mapContainerRef.current.clientWidth, ch = mapContainerRef.current.clientHeight;
    const scale = Math.min(cw / MAP_W, ch / MAP_H) * 0.95;
    cameraRef.current = { x: MAP_W / 2 - (cw / 2) / scale, y: MAP_H / 2 - (ch / 2) / scale, scale };
  };

  const zoom = (factor) => {
    if (!mapContainerRef.current) return;
    const newScale = Math.max(0.2, Math.min(cameraRef.current.scale * factor, 5));
    const cx = mapSize.w / 2, cy = mapSize.h / 2;
    const logicalX = cx / cameraRef.current.scale + cameraRef.current.x, logicalY = cy / cameraRef.current.scale + cameraRef.current.y;
    cameraRef.current = { scale: newScale, x: logicalX - cx / newScale, y: logicalY - cy / newScale };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || phase === 'SETUP' || phase === 'WAITING_ROOM') return;

    const onWheel = (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      let newScale = cameraRef.current.scale * Math.exp(delta);
      newScale = Math.max(0.2, Math.min(newScale, 5));
      const rect = canvas.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      const logicalX = vx / cameraRef.current.scale + cameraRef.current.x;
      const logicalY = vy / cameraRef.current.scale + cameraRef.current.y;
      cameraRef.current = { scale: newScale, x: logicalX - vx / newScale, y: logicalY - vy / newScale };
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0]; const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const cx = (t1.clientX + t2.clientX) / 2; const cy = (t1.clientY + t2.clientY) / 2;
        const rect = canvas.getBoundingClientRect();
        touchInfo.current = { mode: 'pinch', initialDist: dist, startScale: cameraRef.current.scale, startCamX: cameraRef.current.x, startCamY: cameraRef.current.y, vx: cx - rect.left, vy: cy - rect.top };
      }
    };

    const onTouchMove = (e) => {
      if (e.touches.length === 2 && touchInfo.current.mode === 'pinch') {
        e.preventDefault();
        const t1 = e.touches[0]; const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        let newScale = touchInfo.current.startScale * (dist / touchInfo.current.initialDist);
        newScale = Math.max(0.2, Math.min(newScale, 5));
        const { vx, vy, startCamX, startCamY, startScale } = touchInfo.current;
        const logicalX = vx / startScale + startCamX;
        const logicalY = vy / startScale + startCamY;
        cameraRef.current = { scale: newScale, x: logicalX - vx / newScale, y: logicalY - vy / newScale };
      }
    };

    const onTouchEnd = (e) => { if (e.touches.length < 2) touchInfo.current.mode = 'none'; };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [phase]);

  const getPointerPos = (e) => {
    if (!canvasRef.current) return { vx: 0, vy: 0, lx: 0, ly: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX = e.clientX, clientY = e.clientY;
    if (e.type.startsWith('touch') && e.changedTouches?.length > 0) { clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY; }
    const vx = clientX - rect.left, vy = clientY - rect.top;
    return { vx, vy, lx: vx / cameraRef.current.scale + cameraRef.current.x, ly: vy / cameraRef.current.scale + cameraRef.current.y };
  };

  const handlePointerDown = (e) => {
    if ((e.button && e.button !== 0) || (e.type.startsWith('touch') && e.touches?.length > 1) || !gameState) return;
    const { vx, vy, lx, ly } = getPointerPos(e);
    const visibleSet = getVisibleNodes(myPlayerNum, gameState.nodes, gameState.edges, gameState.isTeamBattle);
    const clickedNode = gameState.nodes.find(n => getDistance(n, {x: lx, y: ly}) < (TISSUE_INFO[n.shobaType]?.radius || 35) && !n.isCollected && visibleSet.has(n.id));
    
    if (clickedNode) {
      setHoveredNode(clickedNode.id);
      dragInfo.current = { isDragging: true, wasDragged: false, type: (clickedNode.owner === myPlayerNum && phase === 'INPUT') ? 'node' : 'none', startX: vx, startY: vy, startCamX: cameraRef.current.x, startCamY: cameraRef.current.y, sourceNodeId: clickedNode.id, currentLx: lx, currentLy: ly };
    } else {
      setHoveredNode(null); dragInfo.current = { isDragging: true, wasDragged: false, type: 'pan', startX: vx, startY: vy, startCamX: cameraRef.current.x, startCamY: cameraRef.current.y };
    }
    if(e.pointerId !== undefined) canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const { vx, vy, lx, ly } = getPointerPos(e);
    if (dragInfo.current.isDragging) {
      const dx = vx - dragInfo.current.startX;
      const dy = vy - dragInfo.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
         dragInfo.current.wasDragged = true;
         setHoveredNode(null); 
      }
      if (dragInfo.current.type === 'pan') { 
        cameraRef.current.x = dragInfo.current.startCamX - (dx / cameraRef.current.scale); 
        cameraRef.current.y = dragInfo.current.startCamY - (dy / cameraRef.current.scale); 
      } 
      else if (dragInfo.current.type === 'node') { 
        dragInfo.current.currentLx = lx; 
        dragInfo.current.currentLy = ly; 
      }
    } else {
      if (phase !== 'INPUT' || !gameState) return;
      const visibleSet = getVisibleNodes(myPlayerNum, gameState.nodes, gameState.edges, gameState.isTeamBattle);
      const hovered = gameState.nodes.find(n => getDistance(n, {x: lx, y: ly}) < (TISSUE_INFO[n.shobaType]?.radius || 35) && !n.isCollected && visibleSet.has(n.id));
      setHoveredNode(hovered ? hovered.id : null);
    }
  };

  const handlePointerUp = (e) => {
    if (dragInfo.current.isDragging) {
      if (dragInfo.current.type === 'node' && dragInfo.current.wasDragged) {
         const { lx, ly } = getPointerPos(e);
         const visibleSet = getVisibleNodes(myPlayerNum, gameState.nodes, gameState.edges, gameState.isTeamBattle);
         const targetNode = gameState.nodes.find(n => getDistance(n, {x: lx, y: ly}) < (TISSUE_INFO[n.shobaType]?.radius || 35) && !n.isCollected && visibleSet.has(n.id));
         
         if (targetNode && targetNode.id !== dragInfo.current.sourceNodeId) {
            const sourceNode = gameState.nodes.find(n => n.id === dragInfo.current.sourceNodeId);
            const distHop = getHopDistance(sourceNode.id, targetNode.id, gameState.edges, [], sourceNode.mode === 'long_range');
            let allowedActions = ['move'];
            if (gameModeRefCurrent.current === 'TUTORIAL') allowedActions = PLAYABLE_TUTORIALS.find(s => s.id === tutorialStageRefCurrent.current)?.allowedActions || ['move'];

            if (distHop > 0 && distHop <= (sourceNode.mode === 'long_range' ? 2 : 1) && allowedActions.includes('move')) {
              if (selectedChip?.id === 'STEALTH') {
                 if (!playerCommands.some(c => c.type === 'use_chip' && c.chip === 'STEALTH' && c.targetId === sourceNode.id)) addCommand({ type: 'use_chip', chip: 'STEALTH', playerId: myPlayerNum, chipIdx: selectedChip.idx, targetId: sourceNode.id });
                 setSelectedChip(null);
              }
              setPlayerCommands(prev => {
                 const existingMoves = prev.filter(c => c.type === 'move' && c.nodeId === sourceNode.id);
                 const targetIds = new Set(existingMoves.map(c => c.targetId)); targetIds.add(targetNode.id);
                 const amountPerTarget = Math.floor(sourceNode.energy / targetIds.size);
                 if (amountPerTarget <= 0) return prev;
                 const nextCmds = prev.filter(c => !(c.type === 'move' && c.nodeId === sourceNode.id));
                 Array.from(targetIds).forEach(tId => nextCmds.push({ type: 'move', nodeId: sourceNode.id, targetId: tId, amount: amountPerTarget, playerId: myPlayerNum }));
                 return nextCmds;
              });
              setUiState({ mode: 'IDLE', nodeId: null, targetId: null });
            }
         }
      }
      dragInfo.current.isDragging = false; dragInfo.current.type = 'none';
      if(e.pointerId !== undefined) canvasRef.current?.releasePointerCapture(e.pointerId);
    }
  };

  const handleCanvasClick = (e) => {
    if (dragInfo.current.wasDragged) { dragInfo.current.wasDragged = false; return; }
    if (phase !== 'INPUT' || !gameState.alivePlayers.includes(myPlayerNum)) return;
    const { lx, ly } = getPointerPos(e);
    const visibleSet = getVisibleNodes(myPlayerNum, gameState.nodes, gameState.edges, gameState.isTeamBattle);
    const clickedNode = gameState.nodes.find(n => getDistance(n, {x: lx, y: ly}) < (TISSUE_INFO[n.shobaType]?.radius || 35) && !n.isCollected && visibleSet.has(n.id));

    if (selectedChip) {
      if ((selectedChip.id === 'EMP' || selectedChip.id === 'SABOTAGE') && clickedNode && isEnemy(clickedNode.owner, myPlayerNum, gameState.isTeamBattle) && clickedNode.type !== 'item' && clickedNode.type !== 'dump') {
        if (!playerCommands.some(c => c.type === 'use_chip' && c.chip === selectedChip.id && c.targetId === clickedNode.id)) addCommand({ type: 'use_chip', chip: selectedChip.id, targetId: clickedNode.id, playerId: myPlayerNum, chipIdx: selectedChip.idx });
        setSelectedChip(null); return;
      }
      if ((selectedChip.id === 'MINE_BOOST' || selectedChip.id === 'ATK_BOOST') && (clickedNode && isAlly(clickedNode.owner, myPlayerNum, gameState.isTeamBattle) || clickedNode?.owner === myPlayerNum)) {
        if (!playerCommands.some(c => c.type === 'use_chip' && c.chip === selectedChip.id && c.targetId === clickedNode.id)) addCommand({ type: 'use_chip', chip: selectedChip.id, targetId: clickedNode.id, playerId: myPlayerNum, chipIdx: selectedChip.idx });
        setSelectedChip(null); return;
      }
    }

    if (uiState.mode === 'IDLE' && clickedNode?.owner === myPlayerNum) setUiState({ mode: 'MENU_OPEN', nodeId: clickedNode.id });
    else if (uiState.mode === 'MENU_OPEN' && clickedNode?.id !== uiState.nodeId) setUiState({ mode: 'IDLE', nodeId: null });
    else if (uiState.mode === 'SELECTING_TARGET') {
      const sourceNode = gameState.nodes.find(n => n.id === uiState.nodeId);
      const distHop = getHopDistance(uiState.nodeId, clickedNode?.id, gameState.edges, [], sourceNode.mode === 'long_range');
      if (clickedNode && distHop > 0 && distHop <= (sourceNode.mode === 'long_range' ? 2 : 1)) {
        if (uiState.actionType === 'move') {
          const alreadyAssigned = playerCommands.filter(c => c.nodeId === uiState.nodeId && c.targetId !== clickedNode.id && c.type === 'move').reduce((sum, c) => sum + (c.amount || 0), 0);
          const maxAmount = Math.max(0, sourceNode.energy - alreadyAssigned);
          if (maxAmount > 0) { setAmountSlider(Math.floor(maxAmount / 2) || 1); setUiState({ ...uiState, mode: 'INPUT_AMOUNT', targetId: clickedNode.id, maxAmount }); } 
          else setUiState({ mode: 'IDLE', nodeId: null, targetId: null });
        } else if (uiState.actionType === 'cut' && distHop === 1 && clickedNode.type !== 'item' && clickedNode.type !== 'dump') {
          addCommand({ type: 'cut', nodeId: uiState.nodeId, targetId: clickedNode.id, playerId: myPlayerNum });
        }
      } else setUiState({ mode: 'IDLE', nodeId: null, targetId: null });
    }
  };

  return {
    hoveredNode,
    dragInfo,
    resetCamera,
    zoom,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleCanvasClick
  };
}