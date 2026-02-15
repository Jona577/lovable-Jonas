import React from 'react';

interface StatsProps {
  isDarkMode?: boolean;
}

const Stats: React.FC<StatsProps> = ({ isDarkMode }) => {
  const cardBg = isDarkMode ? 'bg-black' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';
  const borderColor = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  return (
    <div className="animate-fadeIn">
      <header className="mb-8 sm:mb-12">
        <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black ${textColor} tracking-tight`}>Minhas estatísticas</h2>
        <p className="text-slate-500 mt-2 sm:mt-3 font-medium text-base sm:text-lg">Dados transformados em insights.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12">
         <div className={`${cardBg} p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[3rem] border ${borderColor} shadow-sm transition-colors`}>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3 sm:mb-4">Tempo Total</p>
            <h3 className={`text-3xl sm:text-4xl md:text-5xl font-black ${textColor}`}>32.2<span className="text-xl sm:text-2xl text-slate-300 ml-1">h</span></h3>
         </div>
         <div className={`${cardBg} p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[3rem] border ${borderColor} shadow-sm transition-colors`}>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3 sm:mb-4">Power Score</p>
            <h3 className={`text-3xl sm:text-4xl md:text-5xl font-black ${textColor}`}>85%</h3>
         </div>
      </div>
    </div>
  );
};

export default Stats;
