// src/components/Lobby.jsx
import { useState } from 'react';
import { BACKGROUNDS, BACTERIA_NAMES } from '../config/constants';

// ★ propsから不要になった isMobile, layoutMode, setLayoutMode を削除
export default function Lobby({
  setPhase, playerStats, topPlayers, isFirstVisit, handleNameSubmit,
  gameMode, setGameMode,
  startPlayableTutorial, startSoloGame, startWatchGame,
  playerName, setPlayerName,
  roomList, joinRoom,
  isPrivate, setIsPrivate,
  startHosting,
  joinInput, setJoinInput, errorMsg
}) {
  
  // ★ ここにあった rx 関数を削除！
  const getRandomBacteriaName = () => BACTERIA_NAMES[Math.floor(Math.random() * BACTERIA_NAMES.length)];
  const [inputName, setInputName] = useState(() => getRandomBacteriaName());

  // ==========================================
  // 1. 初回アクセス画面
  // ==========================================
  if (isFirstVisit) {
    return (
      <div className="w-full min-h-[100dvh] flex flex-col items-center justify-center font-sans relative p-4" style={{ backgroundImage: BACKGROUNDS.normal, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 2000px rgba(0, 0, 0, 0.85)' }}>
        <div className="bg-slate-900/90 p-8 rounded-2xl border border-slate-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] max-w-sm w-full text-center z-50 backdrop-blur">
          <div className="text-6xl mb-4 animate-bounce">🦠</div>
          <h2 className="text-2xl font-black text-red-500 mb-2">菌バトルへようこそ</h2>
          <p className="text-slate-400 text-sm mb-6">まずは、あなたの菌株に<br/>名前をつけてください。</p>
          <input type="text" value={inputName} onChange={e => setInputName(e.target.value)} placeholder="例: 大腸菌" className="w-full px-4 py-3 rounded-xl bg-slate-900 text-white border border-slate-700 text-lg font-bold mb-4 focus:outline-none focus:border-red-500 text-center" maxLength={12} />
          <button onClick={() => handleNameSubmit(inputName || getRandomBacteriaName())} className="w-full py-4 bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white font-black text-xl rounded-xl shadow-lg transition-transform hover:-translate-y-1">
            感染を開始する
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. メイン画面の「中身」をモードによって切り替える
  // ==========================================
  let mainContent = null;
  if (!gameMode) {
    mainContent = (
      <>
        {/* ★ rxを排除し、md:flex-row などでレスポンシブをすべてTailwindに任せる */}
        <div className="flex flex-col md:flex-row gap-4 w-full px-4 md:px-0 md:max-w-5xl mt-4">
          <button onClick={() => startPlayableTutorial(1)} className="flex-1 bg-black/80 p-4 md:p-6 rounded-xl border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors">
            <span className="text-4xl md:text-5xl mb-2 md:mb-3">🎓</span>
            <h3 className="text-lg md:text-xl text-green-400 font-bold">チュートリアル</h3>
            <p className="text-slate-400 mt-1 md:mt-2 text-[10px] md:text-xs text-center">基本を学びながら<br/>ステージをクリア</p>
          </button>
          <button onClick={() => setGameMode('SOLO')} className="flex-1 bg-black/80 p-4 md:p-6 rounded-xl border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors">
            <span className="text-4xl md:text-5xl mb-2 md:mb-3">👤</span>
            <h3 className="text-lg md:text-xl text-white font-bold">単独感染 (ソロ)</h3>
            <p className="text-slate-400 mt-1 md:mt-2 text-[10px] md:text-xs text-center">宿主の免疫・他菌(AI)と<br/>一人で手軽に争う</p>
          </button>
          <button onClick={() => setGameMode('WATCH_SELECT')} className="flex-1 bg-black/80 p-4 md:p-6 rounded-xl border border-purple-900 shadow-[0_0_15px_rgba(147,51,234,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors">
            <span className="text-4xl md:text-5xl mb-2 md:mb-3">👁️</span>
            <h3 className="text-lg md:text-xl text-purple-400 font-bold">AI観戦 (オート)</h3>
            <p className="text-slate-400 mt-1 md:mt-2 text-[10px] md:text-xs text-center">AI同士の生存競争を<br/>神の視点から観察する</p>
          </button>
          <button onClick={() => setGameMode('MULTI')} className="flex-1 bg-black/80 p-4 md:p-6 rounded-xl border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors">
            <span className="text-4xl md:text-5xl mb-2 md:mb-3">🌐</span>
            <h3 className="text-lg md:text-xl text-red-400 font-bold">複合感染 (マルチ)</h3>
            <p className="text-slate-400 mt-1 md:mt-2 text-[10px] md:text-xs text-center">公開ルームやIDで<br/>別々のスマホやPCで対戦</p>
          </button>
        </div>

        <div className="mt-8 w-full px-4 md:px-0 md:max-w-4xl flex flex-col items-center">
          <h3 className="text-yellow-500 font-bold mb-3 flex items-center gap-2 text-lg">
            <span>👑</span> 歴代の猛毒バクテリア (勝利数 Top 5) <span>👑</span>
          </h3>
          <div className="w-full bg-black/60 border border-yellow-900/50 rounded-xl p-3 backdrop-blur shadow-lg">
            {topPlayers && topPlayers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                {topPlayers.map((p, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
                  const color = i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-400';
                  return (
                    <div key={p.uid} className="bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700 flex flex-row md:flex-col justify-between md:justify-center items-center text-center">
                      <div className={`font-black text-lg ${color} flex items-center gap-1`}>{medal} <span className="inline md:hidden">{i+1}位</span></div>
                      <div className="font-bold text-white text-sm truncate max-w-[120px]">{p.name}</div>
                      <div className="text-red-400 font-bold text-xs">{p.wins} 勝</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-4 text-sm">まだランキングデータがありません<br />最初の勝者になろう</div>
            )}
          </div>
        </div>

        <div className="mt-8 w-full max-w-md flex flex-col items-center">
          <div className="bg-slate-900/80 border border-slate-700 p-4 rounded-xl shadow-lg text-center w-full">
            <h3 className="text-white font-bold mb-2">💡 開発者を応援する</h3>
            <a href="https://ofuse.me/yotatanbe" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium rounded-lg transition-all border border-slate-600 shadow-inner hover:-translate-y-0.5 active:translate-y-0">
              <span>💌</span> 開発者にOFUSE（ファンレター・支援）を送る
            </a>
          </div>
        </div>
      </>
    );
  } 
  else if (gameMode === 'SOLO' || gameMode === 'WATCH_SELECT') {
    mainContent = (
      <div className="bg-black/80 p-6 md:p-8 w-[90%] md:w-auto rounded-xl border border-red-900 shadow-xl backdrop-blur flex flex-col items-center mt-4">
        <h3 className="text-xl md:text-2xl text-white font-bold mb-4 md:mb-6">
          {gameMode === 'SOLO' ? '競合バクテリア数を選択' : '観察するAIの数を選択'}
        </h3>
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 w-full mb-2">
          <button onClick={() => gameMode === 'SOLO' ? startSoloGame(4, true) : startWatchGame(4, true)} className="px-6 md:px-8 py-3 md:py-4 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors text-base md:text-xl w-full border border-emerald-600">2vs2 混合感染(チーム)</button>
          {[2, 3, 4].map(num => (
            <button key={num} onClick={() => gameMode === 'SOLO' ? startSoloGame(num, false) : startWatchGame(num, false)} className="px-6 md:px-8 py-3 md:py-4 bg-red-900 hover:bg-red-800 text-white font-bold rounded-lg transition-colors text-base md:text-xl w-full border border-red-700">{num} 菌株</button>
          ))}
        </div>
      </div>
    );
  } 
  else {
    mainContent = (
      <div className="flex flex-col items-center mt-4 w-full px-4 max-w-4xl">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full">
          <div className="bg-black/80 p-4 rounded-xl border border-red-900 shadow-xl backdrop-blur flex-1 flex flex-col min-h-[250px] max-h-[300px] md:max-h-none md:min-h-[400px]">
            <h3 className="text-lg text-red-400 font-bold mb-3 flex items-center justify-between">
              <span>🌐 感染中宿主一覧 (ロビー)</span>
              <div className="flex items-center gap-2"><span className="text-xs text-emerald-400">🟢 接続済</span></div>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {roomList.filter(r => r.status === 'WAITING' || r.status === 'PLAYING').length === 0 ? (
                <div className="text-center mt-10"><p className="text-slate-500 text-sm mb-2">現在感染・観戦できる宿主はありません。</p></div>
              ) : (
                roomList.filter(r => r.status === 'WAITING' || r.status === 'PLAYING').map((r, idx) => (
                  <div key={idx} className="bg-slate-900/80 p-3 rounded border border-red-900/50 flex justify-between items-center">
                    <div>
                      <div className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block ${r.status === 'PLAYING' ? 'bg-orange-950 text-orange-300' : 'bg-red-950 text-red-300'} mb-1`}>
                        {r.status === 'PLAYING' ? '⚔️ 侵食中 (観戦可)' : '⛺ 募集中'}
                      </div>
                      <div className="font-bold text-white text-sm">{r.roomName}</div>
                      <div className="text-xs text-slate-400 mt-1">{r.isTeamBattle ? '🤝 2vs2 混合' : `🦠 ${r.playerCount}菌株`} | 最初の菌: {r.hostName}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs font-bold text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-slate-700">{r.currentPlayers} / {r.playerCount} 株</span>
                      {r.status === 'PLAYING' ? (
                        <button onClick={() => joinRoom(r.roomId, true)} className="px-4 py-1 bg-orange-800 hover:bg-orange-700 text-white font-bold rounded text-xs transition-colors shadow border border-orange-600">観戦</button>
                      ) : (
                        <button onClick={() => joinRoom(r.roomId)} className="px-4 py-1 bg-red-800 hover:bg-red-700 text-white font-bold rounded text-xs transition-colors shadow border border-red-600">侵入</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full md:w-80">
            <div className="bg-black/80 p-4 rounded-xl border border-red-900 shadow-xl backdrop-blur flex flex-col">
              <h3 className="text-base text-yellow-500 font-bold mb-3">⛺ 新規宿主へ侵入 (ホスト)</h3>
              <div className="flex gap-2 mb-3">
                <input type="text" value={playerName} onChange={e => setPlayerName(e.target.value)} onBlur={() => { const trimmed = playerName.trim(); if (trimmed) handleNameSubmit(trimmed); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const trimmed = playerName.trim(); if (trimmed) handleNameSubmit(trimmed); e.currentTarget.blur(); } }} placeholder="プレイヤー名" className="w-full px-3 py-2 rounded bg-slate-900 text-white border border-slate-700 text-sm font-bold" maxLength={12} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300 mb-4 cursor-pointer w-fit">
                <input type="checkbox" checked={isPrivate} onChange={e=>setIsPrivate(e.target.checked)} className="w-4 h-4 accent-red-600" />
                鍵をかける (一覧に非公開)
              </label>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => startHosting(4, true)} className="w-full mb-1 px-2 py-2 bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded transition-colors text-sm shadow border border-emerald-600">2vs2 混合感染</button>
                {[2, 3, 4].map(num => (
                  <button key={num} onClick={() => startHosting(num, false)} className="flex-1 px-2 py-2 bg-red-900 hover:bg-red-800 text-white font-bold rounded transition-colors text-sm shadow border border-red-700">{num} 菌株</button>
                ))}
              </div>
            </div>

            <div className="bg-black/80 p-4 rounded-xl border border-red-900 shadow-xl backdrop-blur flex flex-col">
              <h3 className="text-base text-slate-300 font-bold mb-3">🔑 IDで侵入 (非公開宿主など)</h3>
              <div className="flex gap-2 w-full">
                <input type="text" placeholder="宿主ID" value={joinInput} onChange={(e) => setJoinInput(e.target.value)} className="flex-1 px-3 py-2 rounded bg-slate-900 text-white border border-slate-700 uppercase font-mono text-center tracking-widest text-sm" maxLength={4} />
                <button onClick={() => joinRoom(joinInput)} disabled={!joinInput} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold rounded transition-colors text-sm shadow">侵入</button>
              </div>
              {errorMsg && <p className="text-red-500 text-xs mt-2 font-bold">{errorMsg}</p>}
            </div>

            {/* ★ isMobile の判定を削除し、Tailwindの「flex md:hidden」でスマホでのみ表示させる */}
            <button 
              onClick={() => setGameMode(null)} 
              className="w-full py-4 bg-slate-800/80 hover:bg-red-900/80 text-white font-black rounded-xl border border-slate-600 transition-all flex md:hidden items-center justify-center gap-2 shadow-lg active:scale-95 mt-2"
            >
              <span className="text-xl">✖</span>
              <span>戻る</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. 共通レイアウトの修正
  // ==========================================
  return (
    <div className="w-full min-h-[100dvh] flex flex-col font-sans relative p-4 overflow-y-auto overflow-x-hidden" style={{ backgroundImage: BACKGROUNDS.normal, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 2000px rgba(0, 0, 0, 0.95)' }}>
      
      {/* ★ 左上のレイアウト切り替えボタンは自動化されたため削除しました！ */}

      {/* 右上のボタン */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-[100] flex gap-2">
        {gameMode ? (
          <button 
            onClick={() => setGameMode(null)} 
            className="w-fit h-fit whitespace-nowrap bg-slate-800/80 hover:bg-red-900/80 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl border border-slate-600 hover:border-red-500 shadow-lg inline-flex items-center justify-center gap-2 transition-all font-bold backdrop-blur text-base"
          >
            <span className="text-lg leading-none">✖</span><span>戻る</span>
          </button>
        ) : (
          <button 
            onClick={() => setPhase('TUTORIAL_SLIDES')} 
            className="w-fit h-fit whitespace-nowrap bg-black/80 hover:bg-slate-900 text-red-300 px-4 py-2.5 md:px-6 md:py-3 rounded-xl border border-red-500/50 transition-colors inline-flex items-center justify-center gap-2 shadow-lg backdrop-blur font-bold text-base"
          >
            <span className="text-xl md:text-2xl">📖</span> <span>生存の掟</span>
          </button>
        )}
      </div>

      <div className="w-full flex flex-col items-center my-auto py-8">
        <div className="mb-8 flex flex-col items-center justify-center gap-3 text-red-400">
          <div className="flex items-center gap-2 md:gap-4">
             <span className="text-4xl md:text-6xl animate-pulse">🦠</span>
             <h1 className="text-5xl md:text-7xl font-black tracking-widest drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] text-red-500 text-center leading-tight">菌バトル</h1>
          </div>
          <div className="bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-full mt-2 shadow-lg flex gap-4 text-sm md:text-base font-bold">
              <span className="text-white">プレイヤー戦績:</span>
              <span className="text-yellow-400">🏆 {playerStats.wins} 勝</span>
              <span className="text-slate-400">💀 {playerStats.losses} 敗</span>
          </div>
        </div>
        
        {mainContent}

      </div>
    </div>
  );
}