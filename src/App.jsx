// src/App.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFirebase } from './hooks/useFirebase';
import { usePeerRTC } from './hooks/usePeerRTC';
import { generateMap } from './game/mapGenerator';
import { simulateTurn, generateCpuCommands } from './game/engine';
import { PLAYABLE_TUTORIALS } from './game/tutorial';
import { drawCanvas } from './game/renderer';
import { MAP_W, MAP_H, BACKGROUNDS, TISSUE_INFO, CHIP_TYPES } from './config/constants';
import { getTeam, isAlly, isEnemy, getVisibleNodes, getDistance, getHopDistance, generateWeather, getWeatherName, getLossRate } from './game/utils';
import { useAiCommander } from './hooks/useAiCommander';
import { useGameLoop } from './hooks/useGameLoop';
import { useGameInput } from './hooks/useGameInput';

import TutorialSlide from './components/TutorialSlide';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import OccupationMeter from './components/OccupationMeter';

import NinjaAd from './components/NinjaAd'; // ←これを追加

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
  //const [hoveredNode, setHoveredNode] = useState(null);
  const [amountSlider, setAmountSlider] = useState(0);
  const [selectedChip, setSelectedChip] = useState(null);
  //const [aiAdvice, setAiAdvice] = useState(null);
  //const [isAiLoading, setIsAiLoading] = useState(false);
  //const [showAiPanel, setShowAiPanel] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => window.innerWidth < 768 ? 210 : 160);
  const [mapSize, setMapSize] = useState({ w: MAP_W, h: MAP_H });
  // ★ 変更＆追加：初回アクセスの判定と名前の記憶
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('kin_battle_player_name') || '');
  const [isFirstVisit, setIsFirstVisit] = useState(() => !localStorage.getItem('kin_battle_player_name'));
  const [isPrivate, setIsPrivate] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false); // ★ここを追加
  
  const [isConnecting, setIsConnecting] = useState(false);
  const connectionTimeoutRef = useRef(null);

  //const [cpuDifficulty, setCpuDifficulty] = useState('gemini'); // テストのため最初はgemini固定
  //const [geminiCommands, setGeminiCommands] = useState(null);
  //const [isGeminiThinking, setIsGeminiThinking] = useState(false);


  const mapContainerRef = useRef(null);
  const initializedCamera = useRef(false);
  const canvasRef = useRef(null);
  const bgImageRef = useRef(null);
  const animRef = useRef({ active: false, progress: 0, data: null });
  const cameraRef = useRef({ x: 0, y: 0, scale: 1 });
//  const dragInfo = useRef({ isDragging: false, wasDragged: false, type: 'none', startX: 0, startY: 0, startCamX: 0, startCamY: 0, sourceNodeId: null, currentLx: 0, currentLy: 0 });
//  const touchInfo = useRef({ mode: 'none', initialDist: 0, startScale: 1, startCamX: 0, startCamY: 0, vx: 0, vy: 0 });
  const resizerDragInfo = useRef({ isDragging: false, startY: 0, startHeight: 0 });
  const handleLockInRef = useRef(null);
  //const lastRequestedTurnRef = useRef(0); // Geminiへの多重送信ストッパー
  //const lastApiCallTimeRef = useRef(0); // ★ 追加：429エラーを防ぐための時計（クールダウン）

  const {
    cpuDifficulty, geminiCommands, isGeminiThinking, aiAdvice, 
    isAiLoading, showAiPanel, setShowAiPanel, handleAiAdvice, lastRequestedTurnRef
  } = useAiCommander({ phase, gameMode, gameState, myPlayerNum, gameData });

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

  // ==========================================
  // ▼ 追加：死亡時（観戦モード）の全自動パス処理
  // ==========================================
  // 常に最新の handleLockIn 関数を保持しておく
  useEffect(() => { handleLockInRef.current = handleLockIn; });

  useEffect(() => {
    if (phase === 'INPUT' && gameState) {
      // 自分が死んでいるか判定
      const isDead = myPlayerNum !== 0 && !gameState.alivePlayers.includes(myPlayerNum);
      
      if (isDead || gameMode === 'WATCH') {
        // 2秒だけ盤面を眺めさせた後、自動で通信（行動完了）を送る！
        const timer = setTimeout(() => {
          if (handleLockInRef.current) handleLockInRef.current();
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [phase, gameState, myPlayerNum, gameMode]);
  // ==========================================

  // フックの呼び出し（topPlayersとupdatePlayerNameFirebaseを追加）
  const { playerStats, roomList, topPlayers, latestHostDataRef, recordGameResult, resetStatsFlag, updateFirebaseRoom, removeRoom, setRoomDisconnectRules, backupRoomState, fetchRoomState, clearRoomState, updatePlayerNameFirebase } = useFirebase(myUid, gameMode, isPrivate);

  // ★ 追加：名前入力完了時の処理
  const handleNameSubmit = (name) => {
    const finalName = name.trim() || 'バクテリア';
    setPlayerName(finalName);
    localStorage.setItem('kin_battle_player_name', finalName);
    updatePlayerNameFirebase(finalName);
    setIsFirstVisit(false);
  };
  
  // ==========================================
  // ▼ 追加：リロード対策（セッション管理と復帰）
  // ==========================================
  const saveSession = useCallback((rId, gMode, pNum) => {
    sessionStorage.setItem('kin_battle_session', JSON.stringify({ roomId: rId, gameMode: gMode, myPlayerNum: pNum }));
  }, []);
  const clearSession = useCallback(() => sessionStorage.removeItem('kin_battle_session'), []);

  // 1. 間違えてリロードした時のストッパー
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (phase === 'INPUT' || phase === 'WAITING_FOR_OTHERS' || phase === 'ANIMATING') {
        e.preventDefault(); e.returnValue = "ゲームが中断されます。よろしいですか？";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [phase]);

  // 2. 起動時にセッションを確認して自動復帰
  useEffect(() => {
    const saved = sessionStorage.getItem('kin_battle_session');
    if (saved && !gameMode) {
      const session = JSON.parse(saved);
      setIsReconnecting(true);
      
      fetchRoomState(session.roomId).then(backup => {
        if (backup && backup.gameState && backup.gameData) {
          setRoomId(session.roomId); setGameMode(session.gameMode); setMyPlayerNum(session.myPlayerNum);
          setGameState(backup.gameState); setGameData(backup.gameData);
          setPhase('WAITING_FOR_OTHERS'); // 復帰直後は安全のため待機状態に

          if (session.gameMode === 'HOST') {
            initHost(session.roomId, () => {
               console.log("ホスト権限を復旧しました");
               setPhase('INPUT'); setIsReconnecting(false);
            });
          } else {
            initClient(session.roomId, () => {
               console.log("ホストへ再接続リクエストを送信");
               sendMessage({ type: 'RECONNECT_REQ', uid: myUid }); // 復帰専用の通信を送る
            });
          }
        } else {
          clearSession(); setIsReconnecting(false);
        }
      }).catch(() => { clearSession(); setIsReconnecting(false); });
    }
  }, []);

  // 3. ホストはターン更新ごとにFirebaseへバックアップ
  useEffect(() => {
    if (gameMode === 'HOST' && gameState && gameData && phase !== 'SETUP') {
      backupRoomState(roomId, gameState, gameData);
    }
  }, [gameState?.turn, phase, gameData?.playerUids]);
  // ==========================================

  const handleNetworkMessage = useCallback((data) => {
    const gMode = gameModeRefCurrent.current, currentPhase = phaseRefCurrent.current, gData = gameDataRefCurrent.current;
    if (gMode === 'HOST') {
      // ▼ 追加：クライアントがリロードして復帰（RECONNECT_REQ）してきた時の処理
      // ▼ 追加：クライアントがリロードして復帰（RECONNECT_REQ）してきた時の処理
      if (data.type === 'RECONNECT_REQ') {
        if (gData && gData.playerUids.includes(data.uid)) {
           sendMessage({ type: 'FULL_STATE_SYNC', targetUid: data.uid, state: stateRefCurrent.current, gameData: gData });
        }
        return;
      }

      // ==========================================
      // ▼ 追加：クライアントが「離脱」した時の処理 (LEAVE)
      // ==========================================
      if (data.type === 'LEAVE') {
        if (!gData) return;
        
        const newUids = gData.playerUids.filter(uid => uid !== data.uid);
        const newPlayerNames = { ...gData.playerNames };
        delete newPlayerNames[data.uid];
        
        const nextData = { ...gData, playerUids: newUids, playerNames: newPlayerNames };
        setGameData(nextData);
        
        if (latestHostDataRef.current) {
          latestHostDataRef.current.currentPlayers = newUids.length;
          updateFirebaseRoom(latestHostDataRef.current);
        }
        
        sendMessage({ type: 'ROOM_UPDATE', gameData: nextData });
        return;
      }
      // ==========================================
      
      // ...（以下、既存の JOIN_REQ や CMD_SUBMIT の処理はそのまま）...
      if (data.type === 'JOIN_REQ') {
        // 観戦者用の同期ロジック
        if (gData?.status === 'PLAYING' && data.isSpectator) {
          const currentState = stateRefCurrent.current;
          if (currentState) {
            sendMessage({ type: 'FULL_STATE_SYNC', targetUid: data.uid, state: currentState, gameData: gData });
          }
          return;
        }

        // ▼ 修正：Reactのルールに従い、安全に状態を更新して通信を行う書き方に戻しました！
        if (currentPhase === 'WAITING_ROOM' && gData) {
          if (gData.playerUids.includes(data.uid)) {
            // 既にいる人（リロード復帰など）には現状をそのまま返す
            sendMessage({ type: 'JOIN_ACK', targetUid: data.uid, playerNum: gData.players[data.uid], gameData: gData });
            sendMessage({ type: 'ROOM_UPDATE', gameData: gData });
          } 
          else if (gData.playerUids.length < gData.playerCount) {
            // 新しい参加者の場合、データを更新する
            const newNum = gData.playerUids.length + 1;
            const newGameData = { 
              ...gData, 
              players: { ...gData.players, [data.uid]: newNum }, 
              playerNames: { ...gData.playerNames, [data.uid]: data.name || `バクテリア${newNum}` }, 
              playerUids: [...gData.playerUids, data.uid] 
            };
            
            // 画面を更新！
            setGameData(newGameData);
            
            // Firebaseのロビー人数も最新化
            if (latestHostDataRef.current) { 
              latestHostDataRef.current.currentPlayers = newGameData.playerUids.length; 
              updateFirebaseRoom(latestHostDataRef.current); 
            }
            
            // 全員に最新情報を通信で配る！
            sendMessage({ type: 'JOIN_ACK', targetUid: data.uid, playerNum: newNum, gameData: newGameData });
            sendMessage({ type: 'ROOM_UPDATE', gameData: newGameData });
          }
        }
      } else if (data.type === 'CMD_SUBMIT') {
        const newGameData = { ...gData, commands: { ...gData.commands, [data.playerNum]: data.commands }, turnReady: { ...gData.turnReady, [data.playerNum]: true } };
        setGameData(newGameData); 
      }
    } else if (gMode === 'CLIENT' || gMode === 'CLIENT_WATCH') {
      
      if (data.type === 'FULL_STATE_SYNC' && data.targetUid === myUid) {
          setGameState(data.state);
          setGameData(data.gameData);
          setPhase('INPUT'); 
          setIsReconnecting(false); // ★追加
          initializedCamera.current = false; 
          saveSession(gData?.roomId || data.gameData.roomId, gMode, data.gameData.players[myUid]); // ★追加
          return;
      }
      
      if (data.type === 'JOIN_ACK' && data.targetUid === myUid) { 
          clearTimeout(connectionTimeoutRef.current); // タイマー解除
          setIsConnecting(false); // ローディング終了
          setMyPlayerNum(data.playerNum); setGameData(data.gameData); setPhase('WAITING_ROOM'); 
          saveSession(data.gameData.roomId, gMode, data.playerNum);
      } 
      else if (data.type === 'ROOM_UPDATE') { setGameData(data.gameData); } 
      else if (data.type === 'GAME_START') { 
          setGameState(data.state); setGameData(data.gameData); setPhase('INPUT'); initializedCamera.current = false; 
          saveSession(data.gameData.roomId, gMode, data.gameData.players[myUid]); // ★追加
      } 
      else if (data.type === 'TURN_RESOLVE') { startAnimation(stateRefCurrent.current, data.nextState, data.animData, data.allCommands, data.isGameOver); }
    }
  }, [myUid]);

  const onPeerError = useCallback((err) => { 
    setErrorMsg('通信に失敗しました。'); 
    setGameMode('MULTI'); 
    setPhase('SETUP'); 
    setIsConnecting(false); 
    clearTimeout(connectionTimeoutRef.current); 
    console.error(err); 
  }, []);
  const { sendMessage, initHost, initClient, destroyPeer, connectionsRef } = usePeerRTC(handleNetworkMessage, onPeerError);

  //useEffect(() => { const handleResize = () => setWindowWidth(window.innerWidth); window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize); }, []);
  //const isMobile = layoutMode === 'mobile' || (layoutMode === 'auto' && windowWidth < 768);
  

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


  // 3. 【追加】マルチプレイ（HOST）用の「全員の行動完了＆Geminiの思考完了」待ち合わせ処理
  useEffect(() => {
    if (gameMode === 'HOST' && phase === 'WAITING_FOR_OTHERS' && gameData && gameState) {
      const hostPlayerNum = gameData.players[myUid];
      if (!gameData.turnReady[hostPlayerNum]) return; // ホスト自身がまだなら待機

      const humanPlayers = Object.values(gameData.players); 
      const aliveHumanPlayers = gameState.alivePlayers.filter(p => humanPlayers.includes(p));
      
      // 生きている人間プレイヤー全員が「行動完了」を押したか？
      if (aliveHumanPlayers.every(p => gameData.turnReady[p]) && aliveHumanPlayers.length > 0) {
        
        // 全員揃った！でもGeminiがまだ考え中なら、ターンを進めずに待機する
        if (cpuDifficulty === 'gemini' && isGeminiThinking) return; 

        // 人間もGeminiも全員揃ったので、ターンを計算する！
        const allCmds = []; 
        aliveHumanPlayers.forEach(p => { if (gameData.commands[p]) allCmds.push(...gameData.commands[p]); });
        
        const cpuPlayers = (gameData.cpuPlayers || []).filter(p => gameState.alivePlayers.includes(p));
        const cpuCmds = (cpuDifficulty === 'gemini' && geminiCommands) ? geminiCommands : generateCpuCommands(gameState, cpuPlayers);
        allCmds.push(...cpuCmds);
        
        const { nextState, animData } = simulateTurn(gameState, allCmds); 
        
        // 計算結果を全員に送信してアニメーション開始
        const newGameData = { ...gameData, commands: {}, turnReady: {} };
        setGameData(newGameData);
        sendMessage({ type: 'TURN_RESOLVE', nextState, animData, allCommands: allCmds, isGameOver: nextState.isGameOver });
        startAnimation(gameState, nextState, animData, allCmds, nextState.isGameOver);
      }
    }
  }, [phase, gameMode, gameData, gameState, myUid, isGeminiThinking, geminiCommands, cpuDifficulty]);


  // 2. プレイヤーが行動完了した時の「待ち合わせ」処理
  useEffect(() => {
     // 変更：WATCH モードも待ち合わせの対象にする
     if ((gameMode === 'SOLO' || gameMode === 'WATCH') && phase === 'WAITING_FOR_OTHERS') {
         if (cpuDifficulty === 'gemini' && isGeminiThinking) return; 

         // 変更：WATCH モードなら全員がAI。SOLOなら自分以外がAI。
         const cpuPlayers = gameMode === 'WATCH' ? gameState.alivePlayers : gameState.alivePlayers.filter(p => p !== myPlayerNum);
         const cpuCmds = (cpuDifficulty === 'gemini' && geminiCommands) ? geminiCommands : generateCpuCommands(gameState, cpuPlayers);
         const allCmds = [...playerCommands, ...cpuCmds];
         const { nextState, animData } = simulateTurn(gameState, allCmds); 
         startAnimation(gameState, nextState, animData, allCmds, nextState.isGameOver);
     }
  }, [phase, isGeminiThinking, geminiCommands, gameMode, gameState, myPlayerNum, playerCommands]);
  // ==========================================

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

  const {
    hoveredNode, dragInfo, resetCamera, zoom,
    handlePointerDown, handlePointerMove, handlePointerUp, handleCanvasClick
  } = useGameInput({
    canvasRef, mapContainerRef, cameraRef, mapSize,
    gameState, phase, myPlayerNum, 
    gameModeRefCurrent, tutorialStageRefCurrent,
    playerCommands, setPlayerCommands,
    uiState, setUiState, setAmountSlider,
    selectedChip, setSelectedChip, addCommand
  });

  useGameLoop({
    canvasRef, cameraRef, bgImageRef, animRef, dragInfo,
    gameState, phase, playerCommands, myPlayerNum, 
    mapSize, uiState, hoveredNode
  });

  // ★ 追加：戦闘開始時にカメラを自動で中央リセットする
  useEffect(() => {
    if (phase === 'INPUT' && !initializedCamera.current && mapSize.w > 0) {
      // 1フレーム待ってレイアウト確定後にリセット
      const timer = setTimeout(() => {
        resetCamera();
        initializedCamera.current = true;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [phase, mapSize.w, resetCamera]);

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
      saveSession(newRoomId, 'HOST', 1); // ★ここを追加：ホストもセッションを保存
      setRoomDisconnectRules(newRoomId);
    });
  };

  // 変更：第2引数 asSpectator (観戦者として参加) を受け取る
  const joinRoom = (rid, asSpectator = false) => {
    if (!rid) return;
    setErrorMsg(''); const targetId = rid.toUpperCase(); setRoomId(targetId);
    
    // ▼ 変更：すぐに画面を切り替えず、ローディング画面を出す
    setIsConnecting(true); 
    
    if (asSpectator) {
        setGameMode('CLIENT_WATCH');
        setMyPlayerNum(0);
    } else {
        setGameMode('CLIENT');
    }
    
    // ▼ 追加：10秒経ってもホストと繋がらなければタイムアウトにする
    connectionTimeoutRef.current = setTimeout(() => {
       setIsConnecting(false);
       setErrorMsg('通信がタイムアウトしました。InPrivateモードやルーターの制限で弾かれている可能性があります。');
       destroyPeer();
       setGameMode(null);
    }, 10000);

    initClient(targetId, () => {
        // 相手と本当に繋がった時だけリクエストを送信する
        sendMessage({ type: 'JOIN_REQ', uid: myUid, name: playerNameRef.current, isSpectator: asSpectator });
    });
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
    // 変更：WATCH モードの場合も追加する
    } else if (gameMode === 'SOLO' || gameMode === 'WATCH') {
      setPhase('WAITING_FOR_OTHERS');
    } else if (gameMode === 'HOST') {
      const newGameData = { ...gameData, commands: { ...gameData.commands, [myPlayerNum]: playerCommands }, turnReady: { ...gameData.turnReady, [myPlayerNum]: true } };
      setGameData(newGameData); setPhase('WAITING_FOR_OTHERS');
    } else if (gameMode === 'CLIENT') {
      sendMessage({ type: 'CMD_SUBMIT', playerNum: myPlayerNum, commands: playerCommands }); setPhase('WAITING_FOR_OTHERS');
    }
  };

  const quitGame = () => {
    setConfirmQuit(false);

    // ▼ 追加：クライアント（参加者）として抜ける場合、ホストに「抜ける」と伝える
    if ((gameModeRefCurrent.current === 'CLIENT' || gameModeRefCurrent.current === 'CLIENT_WATCH') && roomId) {
      sendMessage({ type: 'LEAVE', uid: myUid });
    }

    if (gameModeRefCurrent.current === 'HOST' && roomId) {
        removeRoom(roomId);
        clearRoomState(roomId); // リロード対策：バックアップも消去
    }
    
    clearSession(); // リロード対策：セッション破棄
    
    // ▼ 変更：LEAVEメッセージを確実に届けるため、ほんの少し待ってから切断する
    setTimeout(() => {
      destroyPeer();
    }, 100);
    
    lastRequestedTurnRef.current = 0; // ★ 追加：429エラー対策（ストッパーを初期化）
    
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
    
    // ▼ 追加：ソロ用の名前データをセット
    const dummyPlayers = { 1: { name: playerNameRef.current || 'あなた' } };
    for(let i=2; i<=actualCount; i++) dummyPlayers[i] = { name: `CPU ${i}` };
    setGameData({ players: dummyPlayers });

    setGameState({ ...mapData, turn: 1, weather: 'normal', forecast: generateWeather(), nextTrashTurn: Math.floor(Math.random() * 3) + 3, playerCount: actualCount, alivePlayers: Array.from({length: actualCount}, (_, i) => i + 1), winner: null, isGameOver: false, chips, isTeamBattle, immuneTargets: [] });
    setPlayerCommands([]); setPhase('INPUT'); initializedCamera.current = false;
  };

  const startWatchGame = (playerCount, isTeamBattle = false) => {
    setGameMode('WATCH'); 
    setMyPlayerNum(0); // プレイヤーIDを「0（神の視点）」にする
    const actualCount = isTeamBattle ? 4 : playerCount;
    const mapData = generateMap(actualCount, isTeamBattle); const chips = {}; for (let i=1; i<=actualCount; i++) chips[i] = [];
    
    // ▼ 追加：AI観戦用の名前データをセット
    const dummyPlayers = {};
    for(let i=1; i<=actualCount; i++) dummyPlayers[i] = { name: `AI ${i}` };
    setGameData({ players: dummyPlayers });

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


  return (
    <div className="w-full min-h-[100dvh] bg-black md:pl-[180px]">    
      <>
        <NinjaAd admaxId="f5a61b3274cdb562f5310b90d954026f" position="left" adType="banner" />
        <NinjaAd admaxId="01d5d12fd3c7115aa6023612412aa5da" adType="action" />
      </>
    

      {/* 1. ロビー画面 */}
      {phase === 'SETUP' && (
        <Lobby {...{ setPhase, playerStats, topPlayers, isFirstVisit, handleNameSubmit, gameMode, setGameMode, startPlayableTutorial, startSoloGame, startWatchGame, playerName, setPlayerName, roomList, joinRoom, isPrivate, setIsPrivate, startHosting, joinInput, setJoinInput, errorMsg }} />
      )}

      {/* 2. チュートリアルスライド画面 */}
      {phase === 'TUTORIAL_SLIDES' && (
        <TutorialSlide {...{ tutorialPage, setTutorialPage, setPhase }} />
      )}
      
      {/* 3. マルチプレイ待機画面 */}
      {phase === 'WAITING_ROOM' && (
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
            <button onClick={quitGame} className="px-6 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold rounded-xl transition-all w-full shadow-lg">
              離脱する (ロビーへ戻る)
            </button>
          </div>
        </div>
      )}

      {/* 4. メインのゲーム画面 */}
      {(phase !== 'SETUP' && phase !== 'TUTORIAL_SLIDES' && phase !== 'WAITING_ROOM') && (
          <div className="relative w-full h-full flex-1">
            
            {/* ▼ 修正：メーターを「絶対配置（absolute）」で左下に強制固定する ▼ */}
            {(phase === 'INPUT' || phase === 'WAITING_FOR_OTHERS' || phase === 'ANIMATING') && (
              <OccupationMeter
                gameState={gameState}
                myPlayerNum={myPlayerNum}
                bottomPanelHeight={bottomPanelHeight}
              />
            )}

          {/* ▼ 復元中のローディング画面 ▼ */}
          {isReconnecting && (
            <div className="absolute inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center font-sans touch-none">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
              <h2 className="text-white text-2xl font-black tracking-widest animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">体内データを復元中...</h2>
              <p className="text-slate-400 mt-3 text-sm font-bold">通信経路を再構築しています</p>
            </div>
          )}

          {/* ▼ 接続中のローディング画面 ▼ */}
          {isConnecting && (
            <div className="absolute inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center font-sans touch-none">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
              <h2 className="text-white text-2xl font-black tracking-widest animate-pulse drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">宿主へ接続中...</h2>
              <p className="text-slate-400 mt-3 text-sm font-bold">通信経路を構築しています（最大10秒）</p>
            </div>
          )}

          <GameBoard 
            {...{ gameState, phase, setPhase, myPlayerNum, gameMode, roomId, playerCommands, uiState, setUiState, hoveredNode, amountSlider, setAmountSlider, selectedChip, setSelectedChip, aiAdvice, isAiLoading, showAiPanel, setShowAiPanel, bottomPanelHeight, setBottomPanelHeight, confirmQuit, setConfirmQuit, tutorialStage, animRef, handlePointerDown, handlePointerMove, handlePointerUp, handleCanvasClick, handleResizerPointerDown, handleAiAdvice, handleLockIn, removeCommand, addCommand, handleChipSelect, zoom, resetCamera, startPlayableTutorial, quitGame, mapContainerRef, canvasRef, cameraRef, dragInfo }} 
            gameData={
              (gameMode === 'SOLO' || gameMode === 'WATCH' || gameMode === 'TUTORIAL') ? gameData : (
                gameData ? {
                  ...gameData,
                  players: Object.entries(gameData.players || {}).reduce((acc, [uid, num]) => {
                    acc[num] = { name: gameData.playerNames?.[uid] || `菌株 ${num}` };
                    return acc;
                  }, {})
                } : null
              )
            }
          />
        </div>
      )}
    </div>
  );
}