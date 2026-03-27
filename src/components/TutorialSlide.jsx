// src/components/TutorialSlide.jsx
import { BACKGROUNDS } from '../config/constants';
import { TUTORIAL_SLIDES } from '../game/tutorial';

export default function TutorialSlide({ tutorialPage, setTutorialPage, setPhase }) {
  const slide = TUTORIAL_SLIDES[tutorialPage];

  return (
    <div className="w-full min-h-[100dvh] bg-black flex items-center justify-center font-sans text-white p-4" style={{ backgroundImage: BACKGROUNDS.normal, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: 'inset 0 0 0 2000px rgba(0, 0, 0, 0.85)' }}>
      <div className="w-full max-w-4xl bg-slate-900 border border-red-500/50 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.3)] overflow-hidden flex flex-col h-[90dvh] md:h-auto relative z-10">
        <div className="bg-black px-4 md:px-6 py-3 md:py-4 flex justify-between items-center border-b border-red-900">
          <h2 className="text-lg md:text-2xl font-bold text-red-400 flex items-center gap-2"><span>📖</span> 生存の掟</h2>
          <button onClick={() => { setPhase('SETUP'); setTutorialPage(0); }} className="text-slate-400 hover:text-white text-xl md:text-2xl transition-colors">✖</button>
        </div>
        
        <div className="p-6 md:p-10 flex-1 flex flex-col items-center justify-center text-center overflow-y-auto">
          <div className="text-5xl md:text-7xl mb-6">{slide.icon}</div>
          <h3 className="text-2xl md:text-4xl font-bold text-red-400 mb-6">{slide.title}</h3>
          <p className="text-slate-300 text-base md:text-xl leading-loose whitespace-pre-wrap text-left max-w-3xl">{slide.content}</p>
        </div>

        <div className="bg-black px-4 md:px-8 py-4 md:py-5 flex justify-between items-center border-t border-red-900">
          <button 
            onClick={() => setTutorialPage(p => Math.max(0, p - 1))}
            disabled={tutorialPage === 0}
            className="px-4 md:px-8 py-2 md:py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-colors text-sm md:text-lg"
          >
            ◀ 前へ
          </button>
          
          <div className="flex gap-1 md:gap-3">
            {TUTORIAL_SLIDES.map((_, i) => (
              <div key={i} className={`w-2 h-2 md:w-4 md:h-4 rounded-full transition-colors ${i === tutorialPage ? 'bg-red-400' : 'bg-slate-700'}`}></div>
            ))}
          </div>

          <button 
            onClick={() => {
              if (tutorialPage === TUTORIAL_SLIDES.length - 1) {
                setPhase('SETUP');
                setTutorialPage(0);
              } else {
                setTutorialPage(p => p + 1);
              }
            }}
            className={`px-4 md:px-8 py-2 md:py-3 rounded-lg text-white font-bold transition-colors text-sm md:text-lg ${tutorialPage === TUTORIAL_SLIDES.length - 1 ? 'bg-green-700 hover:bg-green-600' : 'bg-red-700 hover:bg-red-600'}`}
          >
            {tutorialPage === TUTORIAL_SLIDES.length - 1 ? '閉じる' : '次へ ▶'}
          </button>
        </div>
      </div>
    </div>
  );
}