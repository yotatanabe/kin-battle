// src/components/Lobby.jsx
import { useState } from 'react';
import { BACKGROUNDS, BACTERIA_NAMES } from '../config/constants';

export default function Lobby({
  layoutMode, setLayoutMode, isMobile,
  setPhase, playerStats, topPlayers, isFirstVisit, handleNameSubmit, // ★ 追加
  gameMode, setGameMode,
  startPlayableTutorial, startSoloGame, startWatchGame, // 👈 startWatchGame を追加！
  playerName, setPlayerName,
  roomList, joinRoom,
  isPrivate, setIsPrivate,
  startHosting,
  joinInput, setJoinInput, errorMsg
}) {
  
  // スマホ版とPC版でクラス（見た目）を切り替える便利関数
  const rx = (mobileClass, pcClass) => isMobile ? mobileClass : pcClass;

  // ▼変更：ランダムな菌の名前を取得する関数
  const getRandomBacteriaName = () => BACTERIA_NAMES[Math.floor(Math.random() * BACTERIA_NAMES.length)];
  
  // ▼変更：最初からランダムな菌の名前を入力欄にセットしておく！
  const [inputName, setInputName] = useState(() => getRandomBacteriaName());

  if (isFirstVisit) {
    return (
      <div className="w-full min-h-[100dvh] flex flex-col items-center justify-center font-sans relative p-4" style={{ backgroundImage: BACKGROUNDS.normal, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 2000px rgba(0, 0, 0, 0.85)' }}>
        <div className="bg-black/90 p-8 rounded-2xl border border-red-900 shadow-[0_0_30px_rgba(220,38,38,0.5)] max-w-sm w-full text-center z-50 backdrop-blur">
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

  return (
    <div className="w-full min-h-[100dvh] flex flex-col items-center justify-center font-sans relative p-4" style={{ backgroundImage: BACKGROUNDS.normal, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 2000px rgba(0, 0, 0, 0.85)' }}>
      
      <div className="absolute top-2 left-2 z-[100] flex gap-2">
        <button onClick={() => setLayoutMode(m => m === 'auto' ? 'mobile' : m === 'mobile' ? 'pc' : 'auto')} className="bg-black/80 hover:bg-slate-900 p-2 md:px-3 rounded-lg border border-red-900 text-slate-300 backdrop-blur text-xs flex items-center gap-1 shadow-lg">
          {layoutMode === 'auto' ? '🔄 Auto' : layoutMode === 'mobile' ? '📱 スマホ版' : '💻 PC版'}
        </button>
      </div>

      <button onClick={() => setPhase('TUTORIAL_SLIDES')} className={`absolute ${rx('top-12 right-2 px-3 py-2 text-sm', 'top-4 right-4 px-6 py-3 text-base')} bg-black/80 hover:bg-slate-900 text-red-300 rounded-xl border border-red-500/50 transition-colors flex items-center gap-2 shadow-lg backdrop-blur font-bold z-50`}>
        <span className={rx('text-lg','text-2xl')}>📖</span> 生存の掟
      </button>

      <div className={`mb-8 flex flex-col items-center justify-center ${rx('gap-2 mt-16', 'gap-4 mt-0')} text-red-400`}>
        <div className={`flex items-center ${rx('gap-2', 'gap-4')}`}>
           <span className={`${rx('text-4xl', 'text-6xl')} animate-pulse`}>🦠</span>
           <h1 className={`${rx('text-5xl', 'text-7xl')} font-black tracking-widest drop-shadow-[0_0_15px_rgba(220,38,38,0.5)] text-red-500 text-center leading-tight`}>菌バトル</h1>
        </div>
        
        <div className="bg-slate-900/80 border border-slate-700 px-4 py-2 rounded-full mt-3 md:mt-4 shadow-lg flex gap-4 text-sm md:text-base font-bold">
            <span className="text-white">プレイヤー戦績:</span>
            <span className="text-yellow-400">🏆 {playerStats.wins} 勝</span>
            <span className="text-slate-400">💀 {playerStats.losses} 敗</span>
        </div>
      </div>
      
      {!gameMode ? (
        <>
          {/* ▼ 復活した4つのモード選択ボタン ▼ */}
          <div className={`flex ${rx('flex-col gap-4 w-full px-4', 'flex-row gap-4 w-full max-w-5xl')} mt-4`}>
            <button onClick={() => startPlayableTutorial(1)} className={`flex-1 bg-black/80 ${rx('p-4', 'p-6')} rounded-xl border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors`}>
              <span className={`${rx('text-4xl mb-2', 'text-5xl mb-3')}`}>🎓</span>
              <h3 className={`${rx('text-lg', 'text-xl')} text-green-400 font-bold`}>チュートリアル</h3>
              <p className={`text-slate-400 ${rx('mt-1 text-[10px]', 'mt-2 text-xs')} text-center`}>基本を学びながら<br/>ステージをクリア</p>
            </button>
            <button onClick={() => setGameMode('SOLO')} className={`flex-1 bg-black/80 ${rx('p-4', 'p-6')} rounded-xl border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors`}>
              <span className={`${rx('text-4xl mb-2', 'text-5xl mb-3')}`}>👤</span>
              <h3 className={`${rx('text-lg', 'text-xl')} text-white font-bold`}>単独感染 (ソロ)</h3>
              <p className={`text-slate-400 ${rx('mt-1 text-[10px]', 'mt-2 text-xs')} text-center`}>宿主の免疫・他菌(AI)と<br/>一人で手軽に争う</p>
            </button>
            <button onClick={() => setGameMode('WATCH_SELECT')} className={`flex-1 bg-black/80 ${rx('p-4', 'p-6')} rounded-xl border border-purple-900 shadow-[0_0_15px_rgba(147,51,234,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors`}>
              <span className={`${rx('text-4xl mb-2', 'text-5xl mb-3')}`}>👁️</span>
              <h3 className={`${rx('text-lg', 'text-xl')} text-purple-400 font-bold`}>AI観戦 (オート)</h3>
              <p className={`text-slate-400 ${rx('mt-1 text-[10px]', 'mt-2 text-xs')} text-center`}>AI同士の生存競争を<br/>神の視点から観察する</p>
            </button>
            <button onClick={() => setGameMode('MULTI')} className={`flex-1 bg-black/80 ${rx('p-4', 'p-6')} rounded-xl border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.2)] backdrop-blur flex flex-col items-center hover:bg-slate-900 transition-colors`}>
              <span className={`${rx('text-4xl mb-2', 'text-5xl mb-3')}`}>🌐</span>
              <h3 className={`${rx('text-lg', 'text-xl')} text-red-400 font-bold`}>複合感染 (マルチ)</h3>
              <p className={`text-slate-400 ${rx('mt-1 text-[10px]', 'mt-2 text-xs')} text-center`}>公開ルームやIDで<br/>別々のスマホやPCで対戦</p>
            </button>
          </div>

          {/* ▼ 勝利数ランキングボード ▼ */}
          <div className={`mt-8 w-full ${rx('px-4', 'max-w-4xl')} flex flex-col items-center`}>
            <h3 className="text-yellow-500 font-bold mb-3 flex items-center gap-2 text-lg">
              <span>👑</span> 歴代の猛毒バクテリア (勝利数 Top 5) <span>👑</span>
            </h3>
            <div className="w-full bg-black/60 border border-yellow-900/50 rounded-xl p-3 backdrop-blur shadow-lg">
              {topPlayers && topPlayers.length > 0 ? (
                <div className={`grid ${rx('grid-cols-1 gap-2', 'grid-cols-5 gap-2')}`}>
                  {topPlayers.map((p, i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅';
                    const color = i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-400';
                    return (
                      <div key={p.uid} className="bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700 flex flex-row md:flex-col justify-between md:justify-center items-center text-center">
                        <div className={`font-black text-lg ${color} flex items-center gap-1`}>{medal} <span className={rx('inline','hidden')}>{i+1}位</span></div>
                        <div className="font-bold text-white text-sm truncate max-w-[120px]">{p.name}</div>
                        <div className="text-red-400 font-bold text-xs">{p.wins} 勝</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-slate-500 text-center py-4 text-sm">まだデータがありません</div>
              )}
            </div>
          </div>
        </>
      ) : (gameMode === 'SOLO' || gameMode === 'WATCH_SELECT') ? (
        <div className={`bg-black/80 ${rx('p-6 w-[90%]', 'p-8 w-auto')} rounded-xl border border-red-900 shadow-xl backdrop-blur flex flex-col items-center mt-4`}>
          <h3 className={`${rx('text-xl', 'text-2xl')} text-white font-bold ${rx('mb-4', 'mb-6')}`}>
            {gameMode === 'SOLO' ? '競合バクテリア数を選択' : '観察するAIの数を選択'}
          </h3>
          <div className={`flex ${rx('flex-col gap-3', 'flex-row gap-4')} w-full mb-6`}>
            {/* 変更：押した時の関数を分岐させる */}
            <button onClick={() => gameMode === 'SOLO' ? startSoloGame(4, true) : startWatchGame(4, true)} className={`${rx('px-6 py-3', 'px-8 py-4')} bg-emerald-800 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors text-base md:text-xl w-full border border-emerald-600`}>2vs2 混合感染(チーム)</button>
            {[2, 3, 4].map(num => (
              <button key={num} onClick={() => gameMode === 'SOLO' ? startSoloGame(num, false) : startWatchGame(num, false)} className={`${rx('px-6 py-3', 'px-8 py-4')} bg-red-900 hover:bg-red-800 text-white font-bold rounded-lg transition-colors text-base md:text-xl w-full border border-red-700`}>{num} 菌株</button>
            ))}
          </div>
          <button onClick={() => setGameMode(null)} className="text-slate-400 hover:text-white underline mt-2 md:mt-4 text-sm md:text-base">◀ モード選択へ戻る</button>
        </div>
      ) : (
        <div className="flex flex-col items-center mt-4 w-full px-4 max-w-4xl">
          <div className={`flex ${rx('flex-col gap-4', 'flex-row gap-6')} w-full`}>
            
            {/* ロビー一覧 */}
            <div className={`bg-black/80 p-4 rounded-xl border border-red-900 shadow-xl backdrop-blur flex-1 flex flex-col ${rx('min-h-[250px] max-h-[300px]', 'min-h-[400px]')}`}>
              <h3 className="text-lg text-red-400 font-bold mb-3 flex items-center justify-between">
                <span>🌐 感染中宿主一覧 (ロビー)</span>
                <div className="flex items-center gap-2">
                   <span className="text-xs text-emerald-400">🟢 データベース接続済</span>
                </div>
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {/* 変更：WAITING か PLAYING、どちらかの部屋があれば表示 */}
                {roomList.filter(r => r.status === 'WAITING' || r.status === 'PLAYING').length === 0 ? (
                  <div className="text-center mt-10">
                    <p className="text-slate-500 text-sm mb-2">現在感染・観戦できる宿主はありません。</p>
                  </div>
                ) : (
                  // 変更：WAITING か PLAYING、どちらかの部屋をループで回す
                  roomList.filter(r => r.status === 'WAITING' || r.status === 'PLAYING').map((r, idx) => (
                    <div key={idx} className="bg-slate-900/80 p-3 rounded border border-red-900/50 flex justify-between items-center">
                      <div>
                        {/* ステータスラベルを追加 */}
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded inline-block ${r.status === 'PLAYING' ? 'bg-orange-950 text-orange-300' : 'bg-red-950 text-red-300'} mb-1`}>
                            {r.status === 'PLAYING' ? '⚔️ 侵食中 (観戦可)' : '⛺ 募集中'}
                        </div>
                        <div className="font-bold text-white text-sm">{r.roomName}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {r.isTeamBattle ? '🤝 2vs2 混合' : `🦠 ${r.playerCount}菌株`} | 最初の菌: {r.hostName}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs font-bold text-slate-300 bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
                          {r.currentPlayers} / {r.playerCount} 株
                        </span>
                        
                        {/* 変更：ステータスによってボタンを切り替える */}
                        {r.status === 'PLAYING' ? (
                          <button onClick={() => joinRoom(r.roomId, true)} className="px-4 py-1 bg-orange-800 hover:bg-orange-700 text-white font-bold rounded text-xs transition-colors shadow border border-orange-600">
                            観戦
                          </button>
                        ) : (
                          <button onClick={() => joinRoom(r.roomId)} className="px-4 py-1 bg-red-800 hover:bg-red-700 text-white font-bold rounded text-xs transition-colors shadow border border-red-600">
                            侵入
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 部屋作成 & プライベート参加 */}
            <div className={`flex flex-col gap-4 w-full ${rx('','md:w-80')}`}>
              <div className="bg-black/80 p-4 rounded-xl border border-red-900 shadow-xl backdrop-blur flex flex-col">
                <h3 className="text-base text-yellow-500 font-bold mb-3">⛺ 新規宿主へ侵入 (ホスト)</h3>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={playerName} onChange={e=>setPlayerName(e.target.value)} placeholder="プレイヤー名 (例: 大腸菌)" className="w-full px-3 py-2 rounded bg-slate-900 text-white border border-slate-700 text-sm font-bold" maxLength={12} />
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
            </div>

          </div>
          <button onClick={() => setGameMode(null)} className="text-slate-400 hover:text-white underline mt-6 text-sm">◀ モード選択へ戻る</button>
        </div>
      )}
    </div>
  );
}