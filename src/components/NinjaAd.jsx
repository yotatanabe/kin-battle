// src/components/NinjaAd.jsx
import React, { useEffect } from 'react';

export default function NinjaAd({ admaxId, position = 'bottom', adType = 'banner', width = '160px', height = '600px' }) {
  
  useEffect(() => {
    // 1. 広告の情報を登録
    window.admaxads = window.admaxads || [];
    if (!window.admaxads.some(ad => ad.admax_id === admaxId)) {
      window.admaxads.push({ admax_id: admaxId, type: adType });
    }

    // 2. 外部スクリプト（t.js）を読み込む（1回だけ）
    let script = document.getElementById('ninja-admax-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'ninja-admax-script';
      script.src = "https://adm.shinobi.jp/st/t.js";
      script.async = true;
      script.charset = "utf-8";
      document.body.appendChild(script);
    }

    // 3. 画面が切り替わる時のお掃除
    return () => {
      if (window.admaxads) {
        window.admaxads = window.admaxads.filter(ad => ad.admax_id !== admaxId);
      }
    };
  }, [admaxId, adType]);

  // ▼ 【重要】action の場合：Reactに無視されないよう、見えない透明な箱を置く
  if (adType === 'action') {
    return <div style={{ display: 'none' }} data-admax-id={admaxId}></div>; 
  }

  // ▼ banner の場合（左端など）
  let containerClass = "w-full flex justify-center my-4";
  
  if (position === 'left' || position === 'right') {
    // ▼ 【重要】z-[100] を z-[9999] に変更！ゲームの背景より絶対に手前に出します
    containerClass = `hidden md:flex fixed top-1/2 -translate-y-1/2 z-[9999] pointer-events-auto bg-slate-800/80 p-2 rounded-xl backdrop-blur border border-slate-600 shadow-2xl items-center justify-center`;
    if (position === 'left') containerClass += " left-2";
    if (position === 'right') containerClass += " right-2";
  }

  return (
    <div className={containerClass}>
      <div 
        className="admax-ads" 
        data-admax-id={admaxId} 
        style={{ display: 'inline-block', width: width, height: height }}
      ></div>
    </div>
  );
}