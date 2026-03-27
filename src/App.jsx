// src/App.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useFirebase } from './hooks/useFirebase';
import { usePeerRTC } from './hooks/usePeerRTC';
import { generateMap } from './game/mapGenerator';
import { simulateTurn, generateCpuCommands } from './game/engine';
import { PLAYABLE_TUTORIALS } from './game/tutorial';
import { drawCanvas } from './game/renderer';
import { MAP_W, MAP_H, BACKGROUNDS, TISSUE_INFO, CHIP_TYPES } from './config/constants';
import { getTeam, isAlly, isEnemy, getVisibleNodes, getDistance, getHopDistance, generateWeather, getWeatherName } from './game/utils';

import TutorialSlide from './components/TutorialSlide';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

export default function App() {
  const myUid = useRef((() => {
    let uid = localStorage.getItem('kin_battle_uid');
    if (!uid) { uid = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36); localStorage.setItem('kin_battle_uid', uid); }
    return uid;
  })()).current;

  const [gameMode, setGameMode] = useState(null); 
  const [roomId, setRoomId] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [gameData, setGameData] = useState(null);
  const [myPlayerNum, setMyPlayerNum] = useState(1);
  const [phase, setPhase] = useState('SETUP'); 
  const [tutorialPage, setTutorialPage] = useState(0); 
  const [tutorialStage, setTutorialStage] = useState(1); 
  const [gameState, setGameState] = useState(null);
  const [playerCommands, setPlayerCommands] = useState([]); 
  const [uiState, setUiState] = useState({ mode: 'IDLE', nodeId: null, targetId: null, maxAmount: 0 }); 
  const [hoveredNode, setHoveredNode] = useState(null);
  const [amountSlider, setAmountSlider] = useState(0);
  const [selectedChip, setSelectedChip] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [layoutMode, setLayoutMode] = useState('auto'); 
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => window.innerWidth < 768 ? 220 : 160);
  const [mapSize, setMapSize] = useState({ w: MAP_W, h: MAP_H });
  const [playerName, setPlayerName] = useState('バクテリア');
  const [isPrivate, setIsPrivate] = useState(false);
  
  const mapContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const animRef = useRef({ active: false, progress: 0, data: null });
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragInfo = useRef({ isDragging: false, wasDragged: false, type: 'none', startX: 0, startY: 0, startCamX: 0, startCamY: 0, sourceNodeId: null, currentLx: 0, currentLy: 0 });
  const touchInfo = useRef({ mode: 'none', initialDist: 0, startScale: 1, startCamX: 0, startCamY: 0, vx: 0, vy: 0 });
  const resizerDragInfo = useRef({ isDragging: false, startY: 0, startHeight: 0 });

  const stateRefCurrent = useRef(gameState);
  const phaseRefCurrent = useRef(phase);
  const gameDataRefCurrent = useRef(gameData);
  const gameModeRefCurrent = useRef(gameMode);
  const tutorialStageRefCurrent = useRef(tutorialStage);
  const playerNameRef = useRef(playerName);

  useEffect(() => { stateRefCurrent.current = gameState; }, [gameState]);
  useEffect(() => { phaseRefCurrent.current = phase; }, [phase]);
  useEffect(() => { gameDataRefCurrent.current = gameData; }, [gameData]);
  useEffect(() => { gameModeRefCurrent.current = gameMode; }, [gameMode]);
  useEffect(() => { tutorialStageRefCurrent.current = tutorialStage; }, [tutorialStage]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

  // フックの呼び出し
  const { playerStats, roomList, latestHostDataRef, recordGameResult, resetStatsFlag, updateFirebaseRoom, removeRoom, setRoomDisconnectRules } = useFirebase(myUid, gameMode, isPrivate);
  
  const handleNetworkMessage = useCallback((data) => {
    const gMode = gameModeRefCurrent.current, currentPhase = phaseRefCurrent.current, gData = gameDataRefCurrent.current;
    if (gMode === 'HOST') {
      if (data.type === 'JOIN_REQ') {
        if (currentPhase === 'WAITING_ROOM' && gData) {
          if (gData.playerUids.includes(data.uid)) {
            sendMessage({ type: 'JOIN_ACK', targetUid: data.uid, playerNum: gData.players[data.uid], gameData: gData });
            sendMessage({ type: 'ROOM_UPDATE', gameData: gData });
          } else if (gData.playerUids.length < gData.playerCount) {
            const newNum = gData.playerUids.length + 1;
            const newGameData = { ...gData, players: { ...gData.players, [data.uid]: newNum }, playerNames: { ...gData.playerNames, [data.uid]: data.name || `バクテリア${newNum}` }, playerUids: [...gData.playerUids, data.uid] };
            setGameData(newGameData);
            if (latestHostDataRef.current) { latestHostDataRef.current.currentPlayers = newGameData.playerUids.length; updateFirebaseRoom(latestHostDataRef.current); }
            sendMessage({ type: 'JOIN_ACK', targetUid: data.uid, playerNum: newNum, gameData: newGameData });
            sendMessage({ type: 'ROOM_UPDATE', gameData: newGameData });
          }
        }
      } else if (data.type === 'CMD_SUBMIT') {
        const newGameData = { ...gData, commands: { ...gData.commands, [data.playerNum]: data.commands }, turnReady: { ...gData.turnReady, [data.playerNum]: true } };
        setGameData(newGameData); checkTurnResolve(newGameData, stateRefCurrent.current);
      }
    } else if (gMode === 'CLIENT') {
      if (data.type === 'JOIN_ACK' && data.targetUid === myUid) { setMyPlayerNum(data.playerNum); setGameData(data.gameData); setPhase('WAITING_ROOM'); } 
      else if (data.type === 'ROOM_UPDATE') { setGameData(data.gameData); } 
      else if (data.type === 'GAME_START') { setGameState(data.state); setGameData(data.gameData); setPhase('INPUT'); initializedCamera.current = false; } 
      else if (data.type === 'TURN_RESOLVE') { startAnimation(stateRefCurrent.current, data.nextState, data.animData, data.allCommands, data.isGameOver); }
    }
  }, [myUid]);

  const onPeerError = useCallback((err) => { setErrorMsg('通信に失敗しました。'); setGameMode('MULTI'); setPhase('SETUP'); console.error(err); }, []);
  const { sendMessage, initHost, initClient, destroyPeer, connectionsRef } = usePeerRTC(handleNetworkMessage, onPeerError);

  useEffect(() => { const handleResize = () => setWindowWidth(window.innerWidth); window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, []);
  const isMobile = layoutMode === 'mobile' || (layoutMode === 'auto' && windowWidth < 768);
  const initializedCamera = useRef(false);

  // ==========================================
  // 【追加】ここから：Canvasのサイズを画面に合わせて自動調整する処理
  // ==========================================
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setMapSize({ w: entry.contentRect.width, h: entry.contentRect.height });
        }
      }
    });
    if (mapContainerRef.current) resizeObserver.observe(mapContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [phase]);


  useEffect(() => {
    if (phase === 'GAME_OVER' && gameState) {
      if (gameMode !== 'TUTORIAL') recordGameResult(gameState.isTeamBattle ? gameState.winner === getTeam(myPlayerNum, true) : gameState.winner === myPlayerNum, gameState.winner === null);
    } else if (phase === 'SETUP' || phase === 'INPUT') { resetStatsFlag(); }
  }, [phase, gameState, myPlayerNum, gameMode]);

  useEffect(() => {
    if (gameState && gameState.weather) {
      const url = BACKGROUNDS[gameState.weather].match(/url\("(.+)"\)/)[1];
      const img = new Image(); img.src = url; img.onload = () => { bgImageRef.current = img; };
    }
  }, [gameState?.weather]);

  const resetCamera = () => {
    if (!mapContainerRef.current) return;
    const cw = mapContainerRef.current.clientWidth, ch = mapContainerRef.current.clientHeight;
    const scale = Math.min(cw / MAP_W, ch / MAP_H) * 0.95;
    cameraRef.current = { x: MAP_W / 2 - (cw / 2) / scale, y: MAP_H / 2 - (ch / 2) / scale, scale };
  };

  useEffect(() => { if (phase === 'INPUT' && !initializedCamera.current && mapSize.w > 0) { resetCamera(); initializedCamera.current = true; } }, [mapSize, phase]);

  const zoom = (factor) => {
    if (!mapContainerRef.current) return;
    const newScale = Math.max(0.2, Math.min(cameraRef.current.scale * factor, 5));
    const cx = mapSize.w / 2, cy = mapSize.h / 2;
    const logicalX = cx / cameraRef.current.scale + cameraRef.current.x, logicalY = cy / cameraRef.current.scale + cameraRef.current.y;
    cameraRef.current = { scale: newScale, x: logicalX - cx / newScale, y: logicalY - cy / newScale };
  };

  // ==========================================
  // 【追加】マウスホイールとピンチイン・アウトでの拡大縮小
  // ==========================================
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
  // ==========================================

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
      const dx = vx - dragInfo.current.startX, dy = vy - dragInfo.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
         dragInfo.current.wasDragged = true;
         setHoveredNode(null); // ドラッグ（5px以上の移動）が始まった瞬間に解説を強制的に消す！
      }
      if (dragInfo.current.type === 'pan') { cameraRef.current.x = dragInfo.current.startCamX - dx / cameraRef.current.scale; cameraRef.current.y = dragInfo.current.startCamY - dy / cameraRef.current.scale; } 
      else if (dragInfo.current.type === 'node') { dragInfo.current.currentLx = lx; dragInfo.current.currentLy = ly; }
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

  const handleResizerPointerDown = (e) => {
    e.preventDefault(); resizerDragInfo.current = { isDragging: true, startY: e.clientY || e.touches?.[0].clientY, startHeight: bottomPanelHeight };
    document.body.classList.add('resizing');
    const move = (e) => {
      if (!resizerDragInfo.current.isDragging) return; if (e.cancelable) e.preventDefault();
      setBottomPanelHeight(Math.max(80, Math.min(resizerDragInfo.current.startHeight + (resizerDragInfo.current.startY - (e.clientY || e.touches?.[0].clientY)), window.innerHeight * 0.8)));
    };
    const up = () => { resizerDragInfo.current.isDragging = false; document.body.classList.remove('resizing'); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
  };

  const addCommand = (cmd) => {
    setPlayerCommands(prev => {
      if (cmd.type === 'use_chip') return [...prev, cmd]; 
      let nextCmds = prev.filter(c => c.nodeId !== cmd.nodeId || c.type === cmd.type);
      if (cmd.type === 'move') nextCmds = nextCmds.filter(c => !(c.type === 'move' && c.nodeId === cmd.nodeId && c.targetId === cmd.targetId));
      else nextCmds = nextCmds.filter(c => c.nodeId !== cmd.nodeId);
      return [...nextCmds, cmd];
    });
    setUiState({ mode: 'IDLE', nodeId: null, targetId: null });
  };
  
  const removeCommand = (cmdToRemove) => setPlayerCommands(prev => prev.filter(c => c !== cmdToRemove));
  const handleChipSelect = (chipId, idx) => {
    if (playerCommands.filter(c => c.type === 'use_chip').length >= 2 && selectedChip?.idx !== idx) return; 
    if (selectedChip?.idx === idx) { setSelectedChip(null); return; }
    if (chipId === 'BOOST') { if (!playerCommands.some(c => c.type === 'use_chip' && c.chip === 'BOOST')) addCommand({ type: 'use_chip', chip: 'BOOST', playerId: myPlayerNum, chipIdx: idx }); return; }
    setSelectedChip({ id: chipId, idx }); setUiState({ mode: 'IDLE', nodeId: null, targetId: null });
  };

  const startHosting = (pCount, isTeam = false) => {
    setGameMode('HOST'); setMyPlayerNum(1); setErrorMsg(''); setPhase('WAITING_ROOM');
    const newRoomId = Math.random().toString(36).substring(2, 6).toUpperCase(); setRoomId(newRoomId);
    initHost(newRoomId, () => {
      const fullRoomName = `${playerNameRef.current}の体内`;
      const initialGameData = { hostUid: myUid, hostName: playerNameRef.current, roomName: fullRoomName, status: 'WAITING', playerCount: pCount, isTeamBattle: isTeam, players: { [myUid]: 1 }, playerNames: { [myUid]: playerNameRef.current }, playerUids: [myUid], cpuPlayers: [], commands: {}, turnReady: {} };
      setGameData(initialGameData);
      latestHostDataRef.current = { roomId: newRoomId, roomName: fullRoomName, hostName: playerNameRef.current, playerCount: pCount, currentPlayers: 1, isTeamBattle: isTeam, status: 'WAITING' };
      updateFirebaseRoom(latestHostDataRef.current);

      setRoomDisconnectRules(newRoomId);
    });
  };

  const joinRoom = (rid) => {
    if (!rid) return;
    setErrorMsg(''); const targetId = rid.toUpperCase(); setRoomId(targetId); setGameMode('CLIENT'); setPhase('WAITING_ROOM');
    initClient(targetId, () => { sendMessage({ type: 'JOIN_REQ', uid: myUid, name: playerNameRef.current }); });
  };

  const checkTurnResolve = (currentGData, currentState) => {
    const hostPlayerNum = currentGData.players[myUid];
    if (!currentGData.turnReady[hostPlayerNum]) return; 
    const humanPlayers = Object.values(currentGData.players); const aliveHumanPlayers = currentState.alivePlayers.filter(p => humanPlayers.includes(p));
    if (aliveHumanPlayers.every(p => currentGData.turnReady[p]) && aliveHumanPlayers.length > 0) {
      const allCmds = []; aliveHumanPlayers.forEach(p => { if (currentGData.commands[p]) allCmds.push(...currentGData.commands[p]); });
      allCmds.push(...generateCpuCommands(currentState, currentGData.cpuPlayers || []));
      const { nextState, animData } = simulateTurn(currentState, allCmds);
      setGameData({ ...currentGData, commands: {}, turnReady: {} });
      sendMessage({ type: 'TURN_RESOLVE', nextState, animData, allCommands: allCmds, isGameOver: nextState.isGameOver });
      startAnimation(currentState, nextState, animData, allCmds, nextState.isGameOver);
    }
  };

  const startAnimation = (currentState, nextState, animData, allCommands, isGameOver) => {
    setPhase('ANIMATING'); animRef.current = { active: true, progress: 0, data: animData };
    const startTime = performance.now();
    const animate = (time) => {
      let p = Math.min((time - startTime) / 6500, 1.0); animRef.current.progress = p;
      if (p < 1.0) requestAnimationFrame(animate); 
      else {
        animRef.current.active = false;
        const finalState = { ...nextState, nodes: nextState.nodes.filter(n => !n.isCollected), edges: nextState.edges.filter(e => nextState.nodes.some(n => n.id === e.s && !n.isCollected) && nextState.nodes.some(n => n.id === e.t && !n.isCollected)) };
        setGameState(finalState); setPlayerCommands([]);
        if (gameModeRefCurrent.current === 'TUTORIAL') {
          const stageDef = PLAYABLE_TUTORIALS.find(s => s.id === tutorialStageRefCurrent.current);
          if (!finalState.alivePlayers.includes(1)) setPhase('GAME_OVER'); 
          else if (stageDef && stageDef.checkWin(finalState)) setPhase('TUTORIAL_CLEAR'); 
          else setPhase('INPUT');
        } else { setPhase(isGameOver ? 'GAME_OVER' : 'INPUT'); }
      }
    };
    requestAnimationFrame(animate);
  };

  const handleLockIn = () => {
    if (phase !== 'INPUT') return;
    setUiState({ mode: 'IDLE', nodeId: null, targetId: null }); setSelectedChip(null);
    if (gameMode === 'TUTORIAL') {
      const allCmds = [...playerCommands, ...PLAYABLE_TUTORIALS.find(s => s.id === tutorialStage)?.cpuLogic(gameState) || []];
      const { nextState, animData } = simulateTurn(gameState, allCmds); startAnimation(gameState, nextState, animData, allCmds, nextState.isGameOver);
    } else if (gameMode === 'SOLO') {
      const allCmds = [...playerCommands, ...generateCpuCommands(gameState, gameState.alivePlayers.filter(p => p !== 1))];
      const { nextState, animData } = simulateTurn(gameState, allCmds); startAnimation(gameState, nextState, animData, allCmds, nextState.isGameOver);
    } else if (gameMode === 'HOST') {
      const newGameData = { ...gameData, commands: { ...gameData.commands, [myPlayerNum]: playerCommands }, turnReady: { ...gameData.turnReady, [myPlayerNum]: true } };
      setGameData(newGameData); setPhase('WAITING_FOR_OTHERS'); checkTurnResolve(newGameData, gameState);
    } else if (gameMode === 'CLIENT') {
      sendMessage({ type: 'CMD_SUBMIT', playerNum: myPlayerNum, commands: playerCommands }); setPhase('WAITING_FOR_OTHERS');
    }
  };

  const quitGame = () => {
    setConfirmQuit(false);
    if (gameModeRefCurrent.current === 'HOST' && roomId) removeRoom(roomId);
    destroyPeer();
    setPhase('SETUP'); setGameMode(null); setGameState(null); setGameData(null); setRoomId(''); setPlayerCommands([]); setUiState({ mode: 'IDLE', nodeId: null, targetId: null, maxAmount: 0 });
  };

  const startPlayableTutorial = (stageId) => {
    setGameMode('TUTORIAL'); setTutorialStage(stageId); setMyPlayerNum(1);
    const setupData = PLAYABLE_TUTORIALS.find(s => s.id === stageId)?.setup(); if(!setupData) return;
    const chips = {}; for (let i=1; i<=setupData.playerCount; i++) chips[i] = [];
    setGameState({ nodes: setupData.nodes, edges: setupData.edges, turn: 1, weather: 'normal', forecast: 'normal', nextTrashTurn: Math.floor(Math.random() * 3) + 3, playerCount: setupData.playerCount, alivePlayers: Array.from({length: setupData.playerCount}, (_, i) => i + 1), winner: null, isGameOver: false, chips, isTeamBattle: setupData.isTeamBattle || false, immuneTargets: [] });
    setPlayerCommands([]); setPhase('INPUT'); initializedCamera.current = false;
  };

  const startSoloGame = (playerCount, isTeamBattle = false) => {
    setGameMode('SOLO'); setMyPlayerNum(1); const actualCount = isTeamBattle ? 4 : playerCount;
    const mapData = generateMap(actualCount, isTeamBattle); const chips = {}; for (let i=1; i<=actualCount; i++) chips[i] = [];
    setGameState({ ...mapData, turn: 1, weather: 'normal', forecast: generateWeather(), nextTrashTurn: Math.floor(Math.random() * 3) + 3, playerCount: actualCount, alivePlayers: Array.from({length: actualCount}, (_, i) => i + 1), winner: null, isGameOver: false, chips, isTeamBattle, immuneTargets: [] });
    setPlayerCommands([]); setPhase('INPUT'); initializedCamera.current = false;
  };

  const startGame = () => {
    if (gameMode !== 'HOST' || !gameData) return;
    removeRoom(roomId);
    const isTeamBattle = gameData.isTeamBattle || false; const actualCount = isTeamBattle ? 4 : gameData.playerCount;
    const mapData = generateMap(actualCount, isTeamBattle); const chips = {}; for (let i=1; i<=actualCount; i++) chips[i] = [];
    const initialState = { ...mapData, turn: 1, weather: 'normal', forecast: generateWeather(), nextTrashTurn: Math.floor(Math.random() * 3) + 3, playerCount: actualCount, alivePlayers: Array.from({length: actualCount}, (_, i) => i + 1), winner: null, isGameOver: false, chips, isTeamBattle, immuneTargets: [] };
    const newGameData = { ...gameData, cpuPlayers: initialState.alivePlayers.filter(p => !Object.values(gameData.players).includes(p)), status: 'PLAYING' };
    setGameData(newGameData); setGameState(initialState); setPhase('INPUT'); initializedCamera.current = false;
    sendMessage({ type: 'GAME_START', state: initialState, gameData: newGameData });
  };

  const handleAiAdvice = async () => {
    if (!gameState) return;
    
    // 1. 環境変数（.env）からキーを取得。なければローカルストレージを見る
    let GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
    
    if (!GEMINI_API_KEY) {
      GEMINI_API_KEY = prompt("AI参謀を利用するには、Gemini APIキーを入力してください。\n（※キーはブラウザにのみ保存され、外部には送信されません）");
      if (!GEMINI_API_KEY) return; localStorage.setItem('gemini_api_key', GEMINI_API_KEY);
    }
    
    setIsAiLoading(true); setAiAdvice(null); setShowAiPanel(true);
    const visibleNodes = gameState.nodes.filter(n => getVisibleNodes(myPlayerNum, gameState.nodes, gameState.edges, gameState.isTeamBattle).has(n.id));
    const promptText = `現在ターン: ${gameState.turn}期\n生存派閥数: ${gameState.alivePlayers.length}\n自派閥の組織数: ${visibleNodes.filter(n => n.owner === myPlayerNum).length}\nあなたは人体に侵入した新種バクテリアの冷徹な軍師プラスミドです。次の一手の戦術アドバイスを3〜4行で簡潔に提供してください。病原体らしい生々しくもクールな口調でお願いします。`;
    
    try {
      // 2. 安定版の高速モデル（gemini-1.5-flash）に変更
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) 
      });
      
      if (!res.ok) { 
        if (res.status === 400 || res.status === 403) { 
          localStorage.removeItem('gemini_api_key'); setAiAdvice("APIキーが無効です。"); 
        } else setAiAdvice("通信エラーが発生しました。"); 
      } else { 
        const data = await res.json(); 
        setAiAdvice(data.candidates?.[0]?.content?.parts?.[0]?.text || "応答が空でした。"); 
      }
    } catch (e) { 
      setAiAdvice("通信に失敗しました。"); 
    } finally { 
      setIsAiLoading(false); 
    }
  };

  useEffect(() => {
    let animationFrameId;
    const render = (time) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx && gameState && phase !== 'SETUP' && phase !== 'WAITING_ROOM' && phase !== 'TUTORIAL_CLEAR' && phase !== 'TUTORIAL_SLIDES') {
        const calculatePrediction = () => {
          let predicted = JSON.parse(JSON.stringify(gameState.nodes)), inflows = {}; predicted.forEach(n => inflows[n.id] = 0);
          playerCommands.forEach(cmd => {
            const node = predicted.find(n => n.id === cmd.nodeId); if (!node) return;
            if (cmd.type === 'move') {
              node.energy -= cmd.amount; 
              let sent = cmd.amount; if (playerCommands.some(c => c.type === 'use_chip' && c.chip === 'ATK_BOOST' && c.targetId === cmd.nodeId)) sent *= 2;
              inflows[cmd.targetId] += getHopDistance(cmd.nodeId, cmd.targetId, gameState.edges, [], node.mode === 'long_range') === 2 ? (playerCommands.some(c => c.type === 'use_chip' && c.chip === 'BOOST') ? sent : Math.floor(sent * (1 - getLossRate(node.level, gameState.weather)))) : sent;
            } else if (cmd.type === 'upgrade') node.energy -= node.level * 10; else if (cmd.type === 'cut') node.energy -= 10;
          });
          return { predicted, inflows };
        };
        drawCanvas(ctx, mapSize, cameraRef, bgImageRef, gameState, playerCommands, myPlayerNum, uiState, hoveredNode, animRef.current, time, phase, dragInfo, calculatePrediction);
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render(performance.now());
    return () => cancelAnimationFrame(animationFrameId);
  }, [phase, gameState, playerCommands, uiState, hoveredNode, myPlayerNum, mapSize]);

  // レンダリング振り分け
  if (phase === 'SETUP') {
    return <Lobby {...{ layoutMode, setLayoutMode, isMobile, setPhase, playerStats, gameMode, setGameMode, startPlayableTutorial, startSoloGame, playerName, setPlayerName, roomList, joinRoom, isPrivate, setIsPrivate, startHosting, joinInput, setJoinInput, errorMsg }} />;
  }
  if (phase === 'TUTORIAL_SLIDES') {
    return <TutorialSlide {...{ tutorialPage, setTutorialPage, setPhase }} />;
  }
  
  // WAITING_ROOM 画面は GameBoard の中に含まれているか、シンプルに直書き
  // WAITING_ROOM 画面は GameBoard の中に含まれているか、シンプルに直書き
  if (phase === 'WAITING_ROOM') {
    return (
      <div className="w-full h-[100dvh] flex flex-col items-center justify-center font-sans text-white p-4 relative" style={{ backgroundImage: BACKGROUNDS.normal, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 2000px rgba(0, 0, 0, 0.85)' }}>
        <h2 className="text-4xl font-black text-red-500 mb-4 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">✅ 宿主への侵入成功！</h2>
        <div className="bg-black/80 p-6 rounded-xl border border-red-900 shadow-xl backdrop-blur w-full max-w-md mb-8">
          <h3 className="text-lg text-slate-300 mb-4 font-bold border-b border-slate-800 pb-2">感染菌株 ID: {roomId}</h3>
          <ul className="space-y-3">
            {gameData?.playerUids?.map(uid => (
              <li key={uid} className="bg-slate-900/80 px-4 py-3 rounded-lg flex justify-between items-center border border-slate-700">
                <span className="font-bold text-lg">{gameData.playerNames?.[uid]} {uid === myUid ? '(あなた)' : ''}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-md">
          {gameMode === 'HOST' ? (
            <button onClick={startGame} className="px-12 py-5 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-black text-2xl rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all hover:-translate-y-1 w-full">
              感染開始 (空きはAI)
            </button>
          ) : ( 
            <div className="text-red-400 text-lg animate-pulse text-center bg-black/50 py-4 rounded-xl border border-red-900/50">
              ⏳ ホストが感染を開始するのを待っています...
            </div> 
          )}

          {/* 【追加】離脱（キャンセル）ボタン */}
          <button onClick={quitGame} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold rounded-xl transition-all w-full shadow-lg">
            離脱する (ロビーへ戻る)
          </button>
        </div>
      </div>
    );
  }

  return (
    <GameBoard {...{ gameState, phase, setPhase, myPlayerNum, gameMode, gameData, roomId, playerCommands, uiState, setUiState, hoveredNode, amountSlider, setAmountSlider, selectedChip, setSelectedChip, aiAdvice, isAiLoading, showAiPanel, setShowAiPanel, layoutMode, setLayoutMode, isMobile, bottomPanelHeight, setBottomPanelHeight, confirmQuit, setConfirmQuit, tutorialStage, animRef, handlePointerDown, handlePointerMove, handlePointerUp, handleCanvasClick, handleResizerPointerDown, handleAiAdvice, handleLockIn, removeCommand, addCommand, handleChipSelect, zoom, resetCamera, startPlayableTutorial, quitGame, mapContainerRef, canvasRef, cameraRef, dragInfo }} />
  );
}
