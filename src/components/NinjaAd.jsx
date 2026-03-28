// src/components/NinjaAd.jsx
import React, { useEffect } from 'react';

export default function NinjaAd({ admaxId, position = 'bottom' }) {
  useEffect(() => {
    // 1. 忍者AdMaxのタグにある「admaxads.push(...)」と同じ処理をReactで行う
    window.admaxads = window.admaxads || [];
    if (!window.admaxads.some(ad => ad.admax_id === admaxId)) {
      window.admaxads.push({ admax_id: admaxId, type: "banner" });
    }

    // 2. 外部スクリプト「t.js」を読み込む（既に読み込み済みの場合はスキップ）
    let script = document.getElementById('ninja-admax-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'ninja-admax-script';
      script.src = "https://adm.shinobi.jp/st/t.js";
      script.async = true;
      script.charset = "utf-8";
      document.body.appendChild(script);
    }

    // 3. Reactの画面が切り替わった時のお掃除処理
    return () => {
      window.__admax_render__ = undefined;
      window.__admax_tag__ = undefined;
      window.admaxads = [];
    };
  }, [admaxId]);

  let containerClass = "w-full flex justify-center my-4";
  
  if (position === 'right') {
    // 【右端用】黒い半透明の箱。広告サイズに合わせて余白を少し持たせます
    containerClass = "hidden md:flex fixed right-2 top-1/2 -translate-y-1/2 z-[100] pointer-events-auto bg-slate-800/80 p-2 rounded-xl backdrop-blur border border-slate-600 shadow-2xl items-center justify-center";
  }

  return (
    <div className={containerClass}>
      {/* 忍者AdMax指定のdivタグ（幅と高さを指定） */}
      <div 
        className="admax-ads" 
        data-admax-id={admaxId} 
        style={{ display: 'inline-block', width: '160px', height: '600px' }}
      ></div>
    </div>
  );
}