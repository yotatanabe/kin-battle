// src/components/GameBoard.jsx
import React, { useEffect } from 'react'; // 追加
import { BACKGROUNDS, COLORS, TISSUE_INFO, CHIP_TYPES } from '../config/constants';
import { PLAYABLE_TUTORIALS } from '../game/tutorial';
import { getTeam, isAlly, getHopDistance, getTargetableNodes, getWeatherName, getWeatherDesc } from '../game/utils';

export default function GameBoard({
  gameState, phase, setPhase, myPlayerNum, gameMode, gameData, roomId,
  playerCommands, uiState, setUiState, hoveredNode, amountSlider, setAmountSlider,
  selectedChip, setSelectedChip, aiAdvice, isAiLoading, showAiPanel, setShowAiPanel,
  layoutMode, setLayoutMode, isMobile, bottomPanelHeight, setBottomPanelHeight,
  confirmQuit, setConfirmQuit, tutorialStage, animRef,
  handlePointerDown, handlePointerMove, handlePointerUp, handleCanvasClick,
  handleResizerPointerDown, handleAiAdvice, handleLockIn, removeCommand, addCommand,
  handleChipSelect, zoom, resetCamera, startPlayableTutorial, quitGame,
  mapContainerRef, canvasRef, cameraRef, dragInfo
}) {
  const rx = (mobileClass, pcClass) => isMobile ? mobileClass : pcClass;

  useEffect(() => {
    let animationId;
    const updateLabels = () => {
      if (cameraRef.current && gameState) {
        gameState.nodes.forEach(node => {
          if (node.owner !== 0) {
            const el = document.getElementById(`node-label-${node.id}`);
            if (el) {
              const vx = (node.x - cameraRef.current.x) * cameraRef.current.scale;
              const vy = (node.y - cameraRef.current.y) * cameraRef.current.scale;
              // Reactを通さずに直接DOMを動かすことで、ドラッグ中もヌルヌル追従する
              el.style.transform = `translate3d(calc(${vx}px - 50%), calc(${vy}px - 150%), 0)`;
            }
          }
        });
      }
      animationId = requestAnimationFrame(updateLabels);
    };
    updateLabels();
    return () => cancelAnimationFrame(animationId);
  }, [gameState, cameraRef]);

  const renderMenu = () => {
    if (uiState.mode !== 'MENU_OPEN' || !gameState) return null;
    const node = gameState.nodes.find(n => n.id === uiState.nodeId); if (!node) return null;
    
    let allowedActions = ['move', 'toggle_mode', 'upgrade', 'cut'];
    if (gameMode === 'TUTORIAL') {
      const stageDef = PLAYABLE_TUTORIALS.find(s => s.id === tutorialStage);
      if (stageDef && stageDef.allowedActions) allowedActions = stageDef.allowedActions;
    }
    const safeActions = allowedActions || [];

    const existingCmdType = playerCommands.find(c => c.nodeId === node.id)?.type || null;
    const isMoveAllowed = (!existingCmdType || existingCmdType === 'move') && safeActions.includes('move');
    const isOthersAllowed = !existingCmdType;

    const moveAssigned = playerCommands.filter(c => c.nodeId === node.id && c.type === 'move').reduce((s, c) => s + c.amount, 0);
    const availableEnergy = node.energy - moveAssigned;
    const menuWidth = 280, menuHeight = 80;

    const vx = (node.x - cameraRef.current.x) * cameraRef.current.scale;
    const vy = (node.y - cameraRef.current.y) * cameraRef.current.scale;

    let leftPos = vx;
    let topPos = vy - menuHeight - 30;

    if (topPos < 10) topPos = vy + 40; 
    if (leftPos - menuWidth / 2 < 10) leftPos = menuWidth / 2 + 10; else if (leftPos + menuWidth / 2 > 900 - 10) leftPos = 900 - menuWidth / 2 - 10;

    // --- メニューUI (スマホ版とPC版でデザインを分ける) ---
    return (
      <div className={`absolute transform -translate-x-1/2 bg-slate-800/95 backdrop-blur border border-slate-500 ${isMobile ? 'fixed bottom-4 left-1/2 rounded-xl p-2 w-[95%] max-w-sm justify-between z-50 flex gap-2 shadow-[0_10px_25px_rgba(0,0,0,0.8)]' : 'rounded-lg p-2 flex gap-2 shadow-2xl z-20 w-auto'}`} style={isMobile ? {} : { left: `${leftPos}px`, top: `${topPos}px` }}>
        
        {/* ▼ 浸潤ボタン ▼ */}
        <div tabIndex="0" className={`flex-1 ${isMobile ? 'h-14' : 'flex-none w-16 h-16'} relative group outline-none ${!safeActions.includes('move') ? 'hidden' : 'block'}`}>
          <button onClick={() => {
              if (selectedChip?.id === 'STEALTH') {
                if (!playerCommands.some(c => c.type === 'use_chip' && c.chip === 'STEALTH' && c.targetId === node.id)) addCommand({ type: 'use_chip', chip: 'STEALTH', playerId: myPlayerNum, chipIdx: selectedChip.idx, targetId: node.id });
                setUiState({ mode: 'SELECTING_TARGET', nodeId: node.id, actionType: 'move' }); setSelectedChip(null);
              } else setUiState({ mode: 'SELECTING_TARGET', nodeId: node.id, actionType: 'move' });
            }}
            disabled={!isMoveAllowed || availableEnergy <= 0}
            className={`w-full h-full flex flex-col items-center justify-center rounded transition-colors ${selectedChip?.id==='STEALTH' ? 'bg-indigo-600/50 text-indigo-300' : 'bg-sky-600/20 hover:bg-sky-500/40 text-sky-400'} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <span className={isMobile ? "text-lg" : "text-xl"}>➡️</span>
            <span className={`${isMobile ? "text-[9px]" : "text-[10px]"} mt-1 text-center leading-tight`}>浸潤<br/>{selectedChip?.id === 'STEALTH' ? '(隠密)' : ''}</span>
          </button>
          {/* ツールチップ */}
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-slate-300 font-normal leading-relaxed pointer-events-none whitespace-normal text-left">
            別の組織へ菌を移動させます。ドラッグ＆ドロップでも可能です。
          </div>
        </div>

        {/* ▼ 芽胞化ボタン ▼ */}
        <div tabIndex="0" className={`flex-1 ${isMobile ? 'h-14' : 'flex-none w-16 h-16'} relative group outline-none ${!safeActions.includes('toggle_mode') ? 'hidden' : 'block'}`}>
          <button onClick={() => addCommand({ type: 'toggle_mode', nodeId: node.id, playerId: myPlayerNum })} 
            disabled={!isOthersAllowed || !safeActions.includes('toggle_mode')} 
            className={`w-full h-full flex flex-col items-center justify-center rounded bg-purple-600/20 hover:bg-purple-500/40 text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
          >
            <span className={isMobile ? "text-lg" : "text-xl"}>〰️</span>
            {node.mode === 'long_range' ? <span className={`${isMobile ? "text-[9px]" : "text-[10px]"} mt-1 text-center leading-tight`}>定着</span> : <span className={`${isMobile ? "text-[9px]" : "text-[10px]"} mt-1 text-center leading-tight`}>血流乗布</span>}
          </button>
          {/* ツールチップ */}
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-slate-300 font-normal leading-relaxed pointer-events-none whitespace-normal text-left">
            血流(遠隔)モードに切り替えます。増殖が止まる代わりに2マス先まで移動できます。
          </div>
        </div>

        {/* ▼ 増殖強化ボタン ▼ */}
        <div tabIndex="0" className={`flex-1 ${isMobile ? 'h-14' : 'flex-none w-16 h-16'} relative group outline-none ${!safeActions.includes('upgrade') ? 'hidden' : 'block'}`}>
          <button 
            onClick={() => { 
              // ★修正：レベル3未満の時だけコマンドを追加できるようにする
              if (node.energy >= node.level * 10 && node.level < 3) {
                addCommand({ type: 'upgrade', nodeId: node.id, playerId: myPlayerNum }); 
              }
            }} 
            // ★修正：レベル3以上(node.level >= 3)ならボタンを無効化(disabled)する
            disabled={!isOthersAllowed || node.energy < node.level * 10 || node.level >= 3 || !safeActions.includes('upgrade')} 
            className={`w-full h-full flex flex-col items-center justify-center rounded bg-emerald-600/20 hover:bg-emerald-500/40 text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
          >
            <span className={isMobile ? "text-lg" : "text-xl"}>📈</span>
            {/* ★修正：テキストもレベル3で「MAX」になるように変更 */}
            <span className={`${isMobile ? "text-[9px]" : "text-[10px]"} mt-1 text-center leading-tight`}>
              {node.level >= 3 ? 'レベル最大' : '増殖強化'}<br/>
              (-{node.level < 3 ? node.level * 10 : 'MAX'})
            </span>
          </button>
          {/* ツールチップ */}
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-slate-300 font-normal leading-relaxed pointer-events-none whitespace-normal text-left">
            菌を消費して組織のレベルを上げ、最大容量と毎期の増殖量を増やします。
          </div>
        </div>

        {/* ▼ 壁硬化ボタン ▼ */}
        <div tabIndex="0" className={`flex-1 ${isMobile ? 'h-14' : 'flex-none w-16 h-16'} relative group outline-none ${!safeActions.includes('cut') ? 'hidden' : 'block'}`}>
          <button onClick={() => setUiState({ mode: 'SELECTING_TARGET', nodeId: node.id, actionType: 'cut' })} 
            disabled={!isOthersAllowed || node.energy < 10 || !safeActions.includes('cut')} 
            className={`w-full h-full flex flex-col items-center justify-center rounded bg-red-600/20 hover:bg-red-500/40 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors`}
          >
            <span className={isMobile ? "text-lg" : "text-xl"}>✂️</span>
            <span className={`${isMobile ? "text-[9px]" : "text-[10px]"} mt-1 text-center leading-tight`}>壁硬化<br/>(-10)</span>
          </button>
          {/* ツールチップ */}
          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 w-48 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-slate-300 font-normal leading-relaxed pointer-events-none whitespace-normal text-left">
            菌を10消費して、隣接する組織との経路を1ターン防衛（封鎖）します。
          </div>
        </div>
      </div>
    );
  };

  const renderTargetPrompt = () => {
    if (selectedChip?.id === 'EMP' || selectedChip?.id === 'SABOTAGE') {
      return (
        <div className={`absolute top-16 md:top-28 left-1/2 transform -translate-x-1/2 bg-indigo-500/20 text-indigo-300 px-4 md:px-6 py-2 rounded-full border border-indigo-500/50 flex items-center justify-center gap-2 animate-pulse pointer-events-none z-30 text-xs md:text-base w-[90%] md:w-auto text-center`}>
          {CHIP_TYPES[selectedChip.id].name}: 対象の敵組織を選択
        </div>
      );
    }
    if (selectedChip?.id === 'MINE_BOOST' || selectedChip?.id === 'ATK_BOOST') {
      return (
        <div className={`absolute top-16 md:top-28 left-1/2 transform -translate-x-1/2 bg-yellow-500/20 text-yellow-300 px-4 md:px-6 py-2 rounded-full border border-yellow-500/50 flex items-center justify-center gap-2 animate-pulse pointer-events-none z-30 text-xs md:text-base w-[90%] md:w-auto text-center`}>
          {CHIP_TYPES[selectedChip.id].name}: 対象の自派閥組織を選択
        </div>
      );
    }
    if (uiState.mode !== 'SELECTING_TARGET' || !gameState) return null;
    const isLong = gameState.nodes.find(n => n.id === uiState.nodeId)?.mode === 'long_range';
    return (
      <div className={`absolute top-16 md:top-28 left-1/2 transform -translate-x-1/2 bg-yellow-500/20 text-yellow-300 px-4 md:px-6 py-2 rounded-full border border-yellow-500/50 flex items-center justify-center gap-2 animate-pulse pointer-events-none z-30 text-xs md:text-base w-[90%] md:w-auto text-center`}>
        🎯 {uiState.actionType === 'move' ? `対象組織（${isLong ? '遠隔' : '隣接'}）を選択` : '硬化する対象組織を選択'}
      </div>
    );
  };

  const renderSlider = () => {
    if (uiState.mode !== 'INPUT_AMOUNT') return null;
    return (
      <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-800 border border-slate-600 p-4 md:p-6 rounded-xl shadow-2xl z-30 w-[90%] md:w-80 pointer-events-auto`}>
        <h3 className="text-white text-base md:text-lg mb-4 flex items-center gap-2">🦠 浸潤菌数</h3>
        <input type="range" min="1" max={uiState.maxAmount} value={amountSlider} onChange={(e) => setAmountSlider(parseInt(e.target.value))} className="w-full accent-sky-500 mb-4" />
        <div className="flex justify-between text-slate-300 text-sm mb-6"><span>1</span><span className="text-2xl font-bold text-sky-400">{amountSlider}</span><span>{uiState.maxAmount}</span></div>
        <div className="flex gap-3">
          <button onClick={() => setUiState({ mode: 'IDLE' })} className="flex-1 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm md:text-base">キャンセル</button>
          <button onClick={() => addCommand({ type: 'move', nodeId: uiState.nodeId, targetId: uiState.targetId, amount: amountSlider, playerId: myPlayerNum })} className="flex-1 py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm md:text-base">決定</button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[100dvh] bg-black flex flex-col items-center justify-center font-sans select-none text-white overflow-hidden relative">
      
      {/* 画面トップのボタン */}
      {/* ★ 修正：Lobby.jsxのボタンと位置・デザインを完全に統一 */}
      <div className="absolute top-4 left-4 md:top-6 md:left-6 z-[100] flex gap-2">
        <button onClick={() => setLayoutMode(m => m === 'auto' ? 'mobile' : m === 'mobile' ? 'pc' : 'auto')} className="bg-black/80 hover:bg-slate-900 px-3 py-2 md:px-4 md:py-2.5 rounded-xl border border-red-900 text-slate-300 backdrop-blur text-xs md:text-sm flex items-center gap-1 shadow-lg font-bold">
          {layoutMode === 'auto' ? '🔄 Auto' : layoutMode === 'mobile' ? '📱 スマホ版' : '💻 PC版'}
        </button>
      </div>
      {/* ★ 修正：fixed を absolute に変更し、広告被りを防ぐ */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[100] flex gap-2">
        <button onClick={() => setConfirmQuit(true)} className="w-fit h-fit whitespace-nowrap bg-red-900/80 hover:bg-red-800 text-white px-4 py-2.5 rounded-xl border border-red-700 hover:border-red-500 shadow-lg inline-flex items-center justify-center gap-2 transition-all font-bold backdrop-blur text-base">
          <span className="text-lg leading-none">✖</span><span>離脱 / 戻る</span>
        </button>
      </div>

      {confirmQuit && (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-900 p-6 rounded-xl border border-red-900 shadow-[0_0_30px_rgba(220,38,38,0.3)] max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-red-400 mb-4">宿主から離脱しますか？</h3>
            <p className="text-slate-400 text-sm mb-6">対戦中の場合、通信は切断されます。</p>
            <div className="flex gap-4">
              <button onClick={() => setConfirmQuit(false)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg font-bold text-white">キャンセル</button>
              <button onClick={quitGame} className="flex-1 py-3 bg-red-800 hover:bg-red-700 border border-red-600 text-white rounded-lg font-bold">離脱する</button>
            </div>
          </div>
        </div>
      )}
      
      {/* ★ 修正：ヘッダーの開始位置を top-10 → top-16、mt-8 → mt-16 に下げてボタンとの被りを防ぐ */}
      <div className={`w-full max-w-[1200px] flex justify-between items-start pointer-events-none ${rx('absolute top-16 left-0 right-0 px-2 z-[60]', 'flex-shrink-0 p-4 mt-16 z-10')}`}>
        <div className={`flex flex-col ${rx('gap-1', 'gap-2')} pointer-events-auto`}>
          <div className={`flex ${rx('gap-1', 'gap-3')}`}>
            {Array.from({length: gameState.playerCount}).map((_, i) => {
              const p = i + 1; const isAlive = gameState.alivePlayers?.includes(p) ?? false;
              let label = `菌株 ${p}`;
              if (p === myPlayerNum) label = '自派閥';
              else if (gameState.isTeamBattle && getTeam(p, true) === getTeam(myPlayerNum, true)) label = '同盟菌';
              return (
                <div key={p} className={`px-2 py-1 ${rx('','md:px-4 md:py-2')} rounded-lg flex items-center gap-1 border transition-all ${isAlive ? 'opacity-100' : 'opacity-30 grayscale'}`} style={{ borderColor: COLORS.players[p], backgroundColor: `${COLORS.players[p]}44` }}>
                  <span className={`${rx('text-xs', 'text-base')}`}>{p === myPlayerNum ? '🛡️' : '🦠'}</span>
                  <span className={`font-bold ${rx('text-[10px] hidden','text-sm inline')}`}>{label}</span>
                </div>
              );
            })}
          </div>
          {(phase === 'INPUT' || phase === 'WAITING_FOR_OTHERS') && gameState.alivePlayers?.includes(myPlayerNum) && gameState.chips[myPlayerNum]?.length > 0 && (
            <div className={`flex flex-wrap ${rx('gap-1 max-w-[200px]', 'gap-2')} mt-1`}>
              {gameState.chips[myPlayerNum].map((chipId, idx) => {
                const isUsed = playerCommands.some(c => c.type === 'use_chip' && c.chipIdx === idx);
                const usedCount = playerCommands.filter(c => c.type === 'use_chip').length;
                const isDisabled = isUsed || (!isUsed && usedCount >= 2) || phase !== 'INPUT';
                const isSelected = selectedChip?.idx === idx;
                const info = CHIP_TYPES[chipId];
                return (
                  <button key={idx} onClick={() => !isDisabled && handleChipSelect(chipId, idx)} disabled={isDisabled && !isSelected} className={`group relative flex items-center gap-1 ${rx('px-1 py-0.5', 'px-2 py-1')} rounded ${rx('text-[10px]', 'text-xs')} border transition-all outline-none ${isUsed ? 'bg-slate-800 text-slate-500 border-slate-700' : isSelected ? 'bg-red-800 text-white border-red-50 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : isDisabled ? 'bg-slate-900 text-slate-600 border-slate-800 opacity-50' : 'bg-slate-900 text-red-300 border-red-900 hover:bg-slate-800'}`}>
                    <span>{info.icon}</span><span className={`${rx('hidden', 'inline')}`}>{info.name}</span>
                    
                    {/* ▼ アイテム解説のツールチップ ▼ */}
                    <div className="absolute top-full left-0 md:left-1/2 md:-translate-x-1/2 mt-2 w-48 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] text-xs text-slate-300 font-normal leading-relaxed pointer-events-none whitespace-normal text-left">
                      <div className="font-bold text-white mb-1">{info.icon} {info.name}</div>
                      <div>{info.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        
        <div className={`flex flex-col items-end ${rx('gap-1', 'gap-2')}`}>
          {gameMode === 'MULTI' && <div className={`text-red-400 font-mono ${rx('text-[10px]', 'text-sm')} bg-black/80 px-2 py-0.5 rounded border border-red-900 flex items-center gap-1`}><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span><span className={`${rx('hidden', 'inline')}`}>HOST: </span>{roomId}</div>}
          {gameState.isTeamBattle && <div className={`text-emerald-400 font-bold ${rx('text-[10px]', 'text-sm')} bg-black/80 px-2 py-0.5 rounded border border-emerald-900 flex items-center gap-1`}><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>2vs2 混合感染</div>}
          <div className={`flex ${rx('flex-col items-end gap-1', 'flex-row items-center gap-4')} bg-black/80 border border-slate-800 ${rx('px-3 py-1 rounded-lg', 'px-5 py-2 rounded-full')} shadow-lg pointer-events-auto`}>
            {/* ターン数 */}
            <div tabIndex="0" className={`group relative flex items-center gap-1 text-slate-300 outline-none cursor-help ${rx('text-xs', 'text-base')}`}>
              <span className="text-red-500 text-sm md:text-base">⏳</span> <span className="font-bold">第{gameState.turn}期</span>
            </div>
            
            {/* 天候とツールチップ */}
            <div tabIndex="0" className={`group relative flex items-center gap-1 text-slate-300 outline-none cursor-help ${rx('border-none pl-0 text-xs', 'border-l border-slate-700 pl-4 text-base')}`}>
              <span className="w-4 h-4">{gameState.weather === 'tachycardia' ? '💓' : gameState.weather === 'fever' ? '🔥' : '🧬'}</span>
              <span className={`font-bold ${rx('hidden', 'inline')}`}>{getWeatherName(gameState.weather)}</span>
              {/* ▼ 天候の解説ポップアップ ▼ */}
              <div className="absolute top-full mt-2 right-0 w-48 md:w-64 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-slate-300 font-normal leading-relaxed pointer-events-none">
                {getWeatherDesc(gameState.weather)}
              </div>
            </div>

            {/* 崩壊ターンとツールチップ */}
            <div tabIndex="0" className={`group relative flex items-center gap-1 text-orange-400 outline-none cursor-help ${rx('border-none pl-0 text-[10px]', 'border-l border-slate-700 pl-4 text-sm')} font-bold`}>
              💀 <span className={`${rx('hidden', 'inline')}`}>崩壊まであと: </span>{gameState.nextTrashTurn - gameState.turn} 期
              {/* ▼ 崩壊の解説ポップアップ ▼ */}
              <div className="absolute top-full mt-2 right-0 w-48 md:w-64 bg-slate-900 border border-slate-600 p-2 rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-xs text-slate-300 font-normal leading-relaxed pointer-events-none">
                0期になると、マップ上のすべての「壊死部位(ゴミ捨て場)」に大量の栄養素(菌)が発生します。
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas コンテナ */}
      <div className="flex-1 w-full max-w-[1200px] flex flex-col min-h-0 relative z-0">
        <div className={`flex-1 relative bg-black/50 overflow-hidden touch-none ${rx('border-0 rounded-none', 'border border-slate-800 rounded-t-xl')} ${gameState?.immuneTargets?.length > 0 ? 'immune-target' : ''}`} ref={mapContainerRef}>
          
          <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={handlePointerUp} onClick={handleCanvasClick} className={`absolute top-0 left-0 w-full h-full ${phase==='INPUT' ? 'cursor-crosshair' : ''}`} />

          {gameState?.nodes.filter(n => n.owner !== 0).map(node => {
            if (!cameraRef.current) return null;

            const isMe = node.owner === myPlayerNum;
            const isAllyNode = gameState.isTeamBattle && getTeam(node.owner, true) === getTeam(myPlayerNum, true) && !isMe;
            const isEnemyNode = !isMe && !isAllyNode;
            
            // ★修正1：gameData からプレイヤーの本当の名前を取得する
            const rawPlayer = gameData?.players?.[node.owner];
            // データが文字列でもオブジェクト(nameプロパティ)でも対応できる安全な書き方
            const playerName = rawPlayer?.name || rawPlayer || `菌株 ${node.owner}`;

            let labelText = playerName;
            let colorClass = `border-slate-700 bg-slate-900/70 text-slate-300`; // 敵

            if (isMe) {
              labelText = `👑 ${playerName}`; // あなたの名前
              colorClass = `border-sky-500 bg-sky-900/90 text-sky-200 animate-pulse drop-shadow-[0_0_6px_rgba(56,189,248,0.9)] z-10`;
            } else if (isAllyNode) {
              labelText = `🤝 ${playerName}`; // 味方の名前
              colorClass = `border-emerald-500 bg-emerald-900/90 text-emerald-200 z-0`;
            }

            // 初期の座標計算（ドラッグ中は useEffect が上書きして追従させます）
            const vx = (node.x - cameraRef.current.x) * cameraRef.current.scale;
            const vy = (node.y - cameraRef.current.y) * cameraRef.current.scale;

            if (isEnemyNode) {
              const playerColor = COLORS.players[node.owner] || '#475569';
              colorClass = `z-[-10]`;
              return (
                <div 
                  key={`node-label-${node.id}`}
                  id={`node-label-${node.id}`} // ★修正2：追従システムから見つけられるようにIDを付与
                  className={`absolute pointer-events-none transition-opacity duration-200`} // ★修正3：Tailwindのtransformを削除
                  style={{ transform: `translate3d(calc(${vx}px - 50%), calc(${vy}px - 150%), 0)`, zIndex: -10 }} // ★修正4：styleでtransformを直接指定
                >
                  <div className={`px-2 py-0.5 rounded border backdrop-blur-sm whitespace-nowrap text-[9px] md:text-xs text-slate-100 ${colorClass}`} style={{ borderColor: playerColor, backgroundColor: `${playerColor}33` }}>
                    {labelText}
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={`node-label-${node.id}`}
                id={`node-label-${node.id}`} // ★修正2
                className={`absolute pointer-events-none transition-opacity duration-200`} // ★修正3
                style={{ transform: `translate3d(calc(${vx}px - 50%), calc(${vy}px - 150%), 0)` }} // ★修正4
              >
                <div className={`px-2 py-0.5 rounded border backdrop-blur-sm whitespace-nowrap text-[9px] md:text-xs ${colorClass}`}>
                  {labelText}
                </div>
              </div>
            );
          })}

          {/* ▼ 完成版：isDraggingスイッチを直接見て、ドラッグ中だけ消す ▼ */}
          {hoveredNode && phase !== 'ANIMATING' && (() => {
             // ★修正：App.jsxが用意してくれた isDragging スイッチを直接見る！
             if (dragInfo?.current?.isDragging) return null;

             const node = gameState.nodes.find(n => n.id === hoveredNode);
             if (!node) return null;

             const isImmune = gameState.immuneTargets?.includes(node.id);
             const isDump = node.type === 'dump' || node.type === 'trash' || node.name === '壊死部位';
             const isItem = node.type === 'item';

             if (!isImmune && !isDump && !isItem) return null;

             let title = '', desc = '';
             if (isImmune) { title = '🚨 マクロファージ襲来標的'; desc = '今期終了時、この組織にいる菌数は強制的に「半減」させられます。'; }
             else if (isDump) { title = '💀 壊死部位 (ゴミ捨て場)'; desc = '普段は栄養がありませんが、崩壊ターンに大量の栄養素(菌)が発生します。'; }
             else if (isItem) { title = '📦 プラスミド (アイテム)'; desc = '浸潤して破壊すると、強力な「変異遺伝子」を獲得できます。'; }

             const vx = (node.x - cameraRef.current.x) * cameraRef.current.scale;
             const vy = (node.y - cameraRef.current.y) * cameraRef.current.scale;
             const isTop = vy < 100;

             return (
               <div className={`absolute transform -translate-x-1/2 ${isTop ? 'translate-y-4' : '-translate-y-full mb-4'} bg-slate-900/95 border border-slate-600 p-3 rounded-lg shadow-xl z-[60] pointer-events-none w-56 md:w-64 text-left transition-opacity duration-200`} style={{ left: vx, top: vy }}>
                 <div className="text-sm font-bold text-white mb-1">{title}</div>
                 <div className="text-xs text-slate-300 leading-relaxed">{desc}</div>
               </div>
             );
          })()}

          <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20 pointer-events-auto">
            <button onClick={()=>zoom(1.2)} className="bg-black/80 hover:bg-slate-900 p-2 md:p-3 rounded-lg text-slate-300 border border-slate-700 shadow-lg text-lg">➕</button>
            <button onClick={()=>zoom(0.8)} className="bg-black/80 hover:bg-slate-900 p-2 md:p-3 rounded-lg text-slate-300 border border-slate-700 shadow-lg text-lg">➖</button>
            <button onClick={resetCamera} className="bg-black/80 hover:bg-slate-900 p-2 md:p-3 rounded-lg text-slate-300 border border-slate-700 shadow-lg text-lg">🔄</button>
          </div>

          {gameMode === 'TUTORIAL' && phase === 'INPUT' && (
    <div className={`absolute ${rx('top-4 w-[90%]', 'top-8 w-full max-w-3xl')} left-1/2 transform -translate-x-1/2 z-[100] pointer-events-none`}>
      <div className="bg-black/95 border border-red-900 text-red-100 p-3 rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.5)] pointer-events-auto text-center">
                <h3 className={`${rx('text-sm', 'text-lg')} font-bold text-yellow-500 mb-1`}>{PLAYABLE_TUTORIALS.find(s=>s.id === tutorialStage)?.title}</h3>
                <p className={`${rx('text-xs', 'text-sm')} whitespace-pre-wrap leading-relaxed`}>{PLAYABLE_TUTORIALS.find(s=>s.id === tutorialStage)?.message}</p>
              </div>
            </div>
          )}

          {phase === 'ANIMATING' && (
             <div className={`absolute ${rx('top-4 text-xs px-4 py-1', 'top-8 text-xl px-8 py-2')} left-1/2 transform -translate-x-1/2 text-white font-black tracking-widest bg-black/90 border border-red-500 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)] z-10 whitespace-nowrap`}>
               {animRef.current.progress < 0.25 ? 'PHASE 1: 変異・壁硬化' : 
                animRef.current.progress < 0.6 ? 'PHASE 2: 浸潤 & 感染' : 
                animRef.current.progress < 0.85 ? 'PHASE 3: 免疫・組織奪取' : 'PHASE 4: 増殖・生体反応'}
             </div>
          )}

          {phase === 'WAITING_FOR_OTHERS' && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 pointer-events-auto">
              <span className={`${rx('text-4xl mb-4', 'text-6xl mb-6')} animate-spin text-red-500 inline-block`}>🧬</span>
              <h2 className={`${rx('text-lg mb-6', 'text-3xl mb-8')} font-black text-white tracking-widest drop-shadow-lg`}>他菌株の変異を待機中...</h2>
              <div className="flex flex-wrap justify-center gap-2 px-4">
                 {Object.values(gameData?.players || {}).filter(p => gameState.alivePlayers?.includes(p)).map(p => {
                   const isReady = gameData?.turnReady?.[p];
                   return (
                     <div key={p} className={`px-4 py-2 rounded-lg border flex flex-col items-center gap-1 shadow-lg transition-colors ${isReady ? 'bg-red-900/80 border-red-600 text-white' : 'bg-slate-900/80 border-slate-700 text-slate-500'}`}>
                       <span className={`font-bold ${rx('text-sm', 'text-lg')}`}>菌株 {p}</span>
                       <span className="text-[10px]">{isReady ? '変異完了' : '代謝中...'}</span>
                     </div>
                   );
                 })}
              </div>
            </div>
          )}

          {phase === 'TUTORIAL_CLEAR' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 text-center">
              <h1 className={`${rx('text-4xl', 'text-7xl')} font-black mb-4 text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]`}>INFECTION COMPLETE!</h1>
              {tutorialStage < PLAYABLE_TUTORIALS.length ? (
                <button onClick={() => startPlayableTutorial(tutorialStage + 1)} className={`${rx('px-6 py-3 text-base', 'px-10 py-4 text-xl')} bg-slate-800 border border-red-900 hover:bg-slate-700 text-white font-bold rounded-xl mt-4 transition-all shadow-xl pointer-events-auto`}>
                  次の組織へ ▶
                </button>
              ) : (
                <div className="flex flex-col items-center">
                  <p className={`text-yellow-500 ${rx('text-lg mb-4', 'text-2xl mb-6')} font-bold`}>全てのチュートリアルをクリアしました！</p>
                  <button onClick={quitGame} className={`${rx('px-6 py-3 text-base', 'px-10 py-4 text-xl')} bg-slate-800 border border-red-900 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-xl pointer-events-auto`}>
                    タイトルへ戻る
                  </button>
                </div>
              )}
            </div>
          )}

          {phase === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 text-center">
              <h1 className={`${rx('text-4xl', 'text-7xl')} font-black mb-4 drop-shadow-lg`} style={{ color: gameState.winner ? COLORS.players[gameState.winner] : '#cbd5e1', textShadow: '0 0 20px currentColor' }}>
                {gameState.winner === myPlayerNum ? 'PANDEMIC COMPLETE!' : gameState.winner ? `${gameData?.players?.[gameState.winner]?.name || `菌株 ${gameState.winner}`} の支配` : 'COEXISTENCE'}
              </h1>
              {((gameState.isTeamBattle && gameState.winner !== getTeam(myPlayerNum, true) && gameState.winner !== null) || (!gameState.isTeamBattle && gameState.winner !== myPlayerNum && gameState.winner !== null)) && (
                  <p className={`text-red-500 ${rx('text-xl', 'text-2xl')} font-bold mb-4 tracking-widest`}>免疫による完全排除</p>
              )}
              {gameMode === 'TUTORIAL' ? (
                 <button onClick={() => startPlayableTutorial(tutorialStage)} className={`${rx('px-6 py-3 text-base', 'px-10 py-4 text-xl')} bg-slate-800 border border-red-900 hover:bg-slate-700 text-white font-bold rounded-xl mt-4 transition-all shadow-xl pointer-events-auto`}>再感染 (リトライ)</button>
              ) : (
                 <button onClick={quitGame} className={`${rx('px-6 py-3 text-base', 'px-10 py-4 text-xl')} bg-slate-800 border border-red-900 hover:bg-slate-700 text-white font-bold rounded-xl mt-4 transition-all shadow-xl pointer-events-auto`}>タイトルへ戻る</button>
              )}
            </div>
          )}

          {renderTargetPrompt()}
          {renderSlider()}
        </div>

        {/* コントロールパネルのサイズ変更バー */}
        <div className="h-3 md:h-4 bg-slate-900 cursor-row-resize hover:bg-red-900 transition-colors z-30 w-full flex-shrink-0 flex items-center justify-center border-x border-slate-800 pointer-events-auto" onPointerDown={handleResizerPointerDown} style={{ touchAction: 'none' }}>
           <div className="w-12 h-1 bg-slate-600 rounded-full pointer-events-none"></div>
        </div>

        {/* 下部コントロールパネル */}
        {/* ★ 修正1：スマホでも常に flex-row（横並び）にする */}
        <div style={{ height: bottomPanelHeight }} className={`w-full flex flex-row ${rx('gap-2 px-2 py-2 pb-[70px]', 'gap-6 px-4 py-2 md:pb-2')} flex-shrink-0 border-x border-b border-slate-800 rounded-b-xl bg-black pointer-events-auto`}>
          
          <div className={`flex-1 bg-slate-900/50 border border-slate-800 rounded-xl ${rx('p-2', 'p-4')} relative flex flex-col min-h-0 overflow-y-auto`}>
            <h3 className={`text-slate-500 ${rx('text-xs', 'text-sm')} font-bold mb-2 flex items-center justify-between flex-shrink-0`}>
              <div className="flex items-center gap-1">🧬 代謝予定 <span className={`${rx('hidden', 'inline')}`}>(1組織につき1行動)</span></div>
              <button onClick={handleAiAdvice} disabled={gameMode === 'TUTORIAL' || (phase !== 'INPUT' && phase !== 'WAITING_FOR_OTHERS') || isAiLoading || !gameState?.alivePlayers?.includes(myPlayerNum)} className={`flex items-center gap-1 bg-red-900/30 hover:bg-red-900/60 text-red-400 ${rx('px-2 py-1 text-[10px]', 'px-3 py-1 text-xs')} rounded transition-colors border border-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed`}>
                ✨ <span className={`${rx('hidden', 'inline')}`}>プラスミドAIに</span>解析
              </button>
            </h3>
           {!gameState?.alivePlayers?.includes(myPlayerNum) && (phase === 'INPUT' || phase === 'WAITING_FOR_OTHERS') ? (
               <div className={`text-red-600 ${rx('text-[10px]', 'text-sm')} flex-shrink-0`}>あなたの菌株は排除されました。観測モードです。</div>
            ) : (
              <div className={`flex flex-wrap ${rx('gap-1', 'gap-2')} content-start`}>
                {playerCommands.map((cmd, idx) => (
                   <div key={idx} className={`group relative border rounded ${rx('px-2 py-1 text-[10px]', 'px-3 py-1.5 text-sm')} flex items-center gap-1 shadow cursor-help ${cmd.type === 'use_chip' ? 'bg-red-950/80 border-red-800 text-red-200' : 'bg-slate-800 border-slate-700 text-slate-300'}`}>
                    {cmd.type === 'move' && <><span className="text-red-500">➡️</span> {cmd.nodeId} → {cmd.targetId} ({cmd.amount})</>}
                    {cmd.type === 'toggle_mode' && <><span className="text-purple-500">〰️</span> {cmd.nodeId} 芽胞化</>}
                    {cmd.type === 'upgrade' && <><span className="text-emerald-500">📈</span> {cmd.nodeId} 増殖強化</>}
                    {cmd.type === 'cut' && <><span className="text-orange-500">✂️</span> {cmd.nodeId}-{cmd.targetId} 硬化</>}
                    {cmd.type === 'use_chip' && <><span className="text-red-400">{CHIP_TYPES[cmd.chip].icon}</span> {CHIP_TYPES[cmd.chip].name}</>}
                    {phase === 'INPUT' && <button onClick={() => removeCommand(cmd)} className="text-slate-600 hover:text-white ml-1">✖</button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ★ 修正2：スマホ時は幅を w-20 に固定し、アイコンと文字を縦(flex-col)に並べる */}
          {!gameState?.alivePlayers?.includes(myPlayerNum) ? (
            <div className={`flex-shrink-0 ${rx('w-20 flex-col', 'md:w-64 flex-row')} bg-slate-900 border border-slate-800 text-slate-500 font-bold rounded-xl flex items-center justify-center gap-1 shadow-inner ${rx('text-[10px]', 'text-lg')}`}>
              <span className="text-lg">⏳</span>
              <span className="animate-pulse text-center leading-tight">観戦中</span>
            </div>
          ) : (
            <button onClick={handleLockIn} disabled={phase !== 'INPUT'} className={`flex-shrink-0 ${rx('w-20', 'md:w-64')} bg-gradient-to-r from-red-900 to-red-700 hover:from-red-800 disabled:from-slate-800 disabled:to-slate-900 disabled:text-slate-700 disabled:border-slate-800 border border-red-600 text-white font-black rounded-xl transition-all flex ${rx('flex-col', 'flex-row')} items-center justify-center ${rx('gap-0', 'gap-2')} shadow-[0_0_15px_rgba(220,38,38,0.2)]`}>
              <span className={`${rx('text-2xl mb-1', 'text-2xl')}`}>🧬</span>
              <span className={`${rx('text-[11px] leading-tight text-center', 'text-2xl')}`}>行動<br className="md:hidden"/>完了</span>
            </button>
          )}
        </div>
      </div>

      {renderMenu()}
      
      {showAiPanel && (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 pointer-events-auto">
          <div className="bg-slate-900 p-6 rounded-xl border border-red-900 shadow-[0_0_30px_rgba(220,38,38,0.4)] max-w-lg w-full relative">
            <button onClick={() => setShowAiPanel(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white text-xl">✖</button>
            <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2"><span>🧬</span> プラスミドAI 解析結果</h3>
            <div className="bg-black border border-slate-800 rounded-lg p-4 min-h-[120px] text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {isAiLoading ? <span className="animate-pulse text-red-500">宿主環境を解析中...</span> : aiAdvice}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
