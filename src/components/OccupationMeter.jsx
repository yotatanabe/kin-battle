// src/components/OccupationMeter.jsx
import React from 'react';
import { getTeam } from '../game/utils';

export default function OccupationMeter({ gameState, myPlayerNum }) {
  if (!gameState) return null;

  const isTeam = gameState.isTeamBattle;
  const targetCount = isTeam ? 15 : 10; // 勝利条件：チーム15 / 個人10
  
  // チーム判定
  const myTeam = getTeam(myPlayerNum, isTeam);

  // 占領数をカウント
  const currentCount = gameState.nodes.filter(n => {
    if (isTeam) {
      return n.owner !== 0 && getTeam(n.owner, true) === myTeam;
    }
    return n.owner === myPlayerNum;
  }).length;

  const progress = Math.min((currentCount / targetCount) * 100, 100);

  // プレイヤーカラーの取得
  const playerColors = {
    1: 'from-blue-600 to-blue-400',
    2: 'from-red-600 to-red-400',
    3: 'from-green-600 to-green-400',
    4: 'from-yellow-600 to-yellow-400',
  };
  const colorClass = playerColors[myPlayerNum] || 'from-slate-600 to-slate-400';

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[50] w-full max-w-xs md:max-w-md px-4">
      {/* ラベル部分 */}
      <div className="flex justify-between items-end mb-1 px-1">
        <span className="text-white text-xs md:text-sm font-black tracking-widest drop-shadow-md">
          {isTeam ? 'TEAM INFECTION' : 'SOLO DOMINATION'}
        </span>
        <span className="text-white text-lg md:text-2xl font-black italic tabular-nums drop-shadow-md">
          {currentCount} <span className="text-xs md:text-sm not-italic opacity-70">/ {targetCount}</span>
        </span>
      </div>

      {/* メーター外枠 */}
      <div className="h-3 md:h-4 w-full bg-black/60 rounded-full border border-white/20 backdrop-blur-sm overflow-hidden p-[2px]">
        {/* メーター中身（光るアニメーション付き） */}
        <div 
          className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-1000 ease-out relative shadow-[0_0_10px_rgba(255,255,255,0.3)]`}
          style={{ width: `${progress}%` }}
        >
          {/* 先端の光 */}
          <div className="absolute right-0 top-0 h-full w-4 bg-white/40 blur-sm"></div>
        </div>
      </div>

      {/* 勝利目前の警告表示 */}
      {currentCount >= (targetCount - 2) && currentCount < targetCount && (
        <div className="text-center mt-1 animate-pulse">
          <span className="text-red-400 text-[10px] md:text-xs font-bold tracking-tighter">
            ⚠️ WARNING: DOMINATION IMMINENT ⚠️
          </span>
        </div>
      )}
    </div>
  );
}