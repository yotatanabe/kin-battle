// src/components/NinjaAd.jsx
import React, { useEffect } from 'react';

export default function NinjaAd({ admaxId, position = 'bottom' }) {
  useEffect(() => {
    // 1. 広告の情報をグローバル変数に登録する（React SPA対策）
    window.admaxads = window.admaxads || [];
    if (!window.admaxads.some(ad => ad.admax_id === admaxId)) {
        window.admaxads.push({ admax_id: admaxId, type: 'banner' });
    }

    // 2. 忍者AdMaxのスクリプトを読み込む
    const script = document.createElement('script');
    script.src = "https://adm.shinobi.jp/st/t.js";
    script.async = true;
    script.charset = "utf-8";
    document.body.appendChild(script);

    return () => {
      // 3. コンポーネントが消える時のクリーンアップ（React SPA対策）
      window.__admax_render__ = undefined;
      window.__admax_tag__ = undefined;
      window.admaxads = [];
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [admaxId]);

  let containerClass = "w-full flex justify-center my-4";
  
  if (position === 'right') {
    // 背景色と枠線を一旦目立たせて、広告枠が「存在しているか」を確認しやすくしています
    containerClass = "hidden md:flex fixed right-2 top-1/2 -translate-y-1/2 z-[100] pointer-events-auto bg-slate-800/80 p-2 rounded-xl backdrop-blur border border-slate-600 shadow-2xl min-w-[176px] min-h-[616px] items-center justify-center";
  }

  return (
    <div className={containerClass}>
      {/* 忍者AdMaxの広告枠 */}
      <div className="admax-ads" data-admax-id={admaxId}></div>
    </div>
  );
}