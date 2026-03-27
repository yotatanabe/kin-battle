// src/config/constants.js

export const MAP_W = 900;
export const MAP_H = 600;

export const COLORS = {
  bg: '#000000', edge: '#fca5a5', neutral: '#64748b', dump: '#64748b',
  players: ['#64748b', '#3b82f6', '#ef4444', '#22c55e', '#eab308'],
  highlight: '#facc15', long_range: '#a855f7'
};


export const BACKGROUNDS = {
  normal: 'url("https://images.unsplash.com/photo-1614850715649-1d0106293cb1?auto=format&fit=crop&q=80&w=900&h=600")',
  fever: 'url("https://images.unsplash.com/photo-1576502200916-3808e07386a5?auto=format&fit=crop&q=80&w=900&h=600")',
  tachycardia: 'url("https://images.unsplash.com/photo-1557672172-298e090bd0f1?auto=format&fit=crop&q=80&w=900&h=600")'
};

export const CHIP_TYPES = {
  EMP: { id: 'EMP', name: '溶解酵素', desc: '敵の防壁(カット)を溶かす', icon: '🧬' },
  STEALTH: { id: 'STEALTH', name: '免疫擬態', desc: '悟られずに浸潤する', icon: '🥷' },
  BOOST: { id: 'BOOST', name: '鞭毛モーター', desc: '1T 血流移動ロス0', icon: '〰️' },
  MINE_BOOST: { id: 'MINE_BOOST', name: '異常代謝', desc: '1T 選択組織の増殖量x2', icon: '♨️' },
  ATK_BOOST: { id: 'ATK_BOOST', name: '猛毒素', desc: '1T 選択組織の攻撃力x2', icon: '☠️' },
  SABOTAGE: { id: 'SABOTAGE', name: 'バクテリオシン', desc: '1T 敵組織の増殖停止', icon: '💊' }
};

export const TISSUE_INFO = {
  mucosa: { name: '粘膜細胞', radius: 35, icon: '🦠' },
  epithelium: { name: '上皮組織', radius: 20, icon: '🧬' },
  muscle: { name: '筋肉組織', radius: 28, icon: '🥩' },
  organ: { name: '主要臓器', radius: 32, icon: '🫀' },
  necrosis: { name: '壊死部位', radius: 32, icon: '💀' },
};

// ▼ 新たに追加する菌の名前リスト ▼
export const BACTERIA_NAMES = [
  "大腸菌", "乳酸菌", "納豆菌", "ビフィズス菌", "枯草菌", 
  "黄色ブドウ球菌", "表皮ブドウ球菌", "ミュータンス菌", "ピロリ菌", "サルモネラ菌", 
  "ボツリヌス菌", "破傷風菌", "コレラ菌", "ペスト菌", "結核菌", 
  "緑膿菌", "肺炎球菌", "髄膜炎菌", "カンピロバクター", "赤痢菌", 
  "腸炎ビブリオ", "リステリア菌", "レジオネラ菌", "アクネ菌", "放線菌", 
  "酵母菌", "麹菌", "セレウス菌", "ウェルシュ菌", "インフルエンザ菌", 
  "マイコプラズマ", "アシネトバクター", "チフス菌", "ブルセラ菌", "野兎病菌", 
  "炭疽菌", "ジフテリア菌", "百日咳菌", "淋菌", "梅毒トレポネーマ"
];
