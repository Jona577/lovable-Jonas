import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ResetAll: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Apaga completamente o localStorage do app
    localStorage.clear();

    // Redireciona para o app inicial em 2 segundos
    const timer = setTimeout(() => {
      navigate('/');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6 font-sans">
      <div className="bg-slate-800 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center text-center max-w-md w-full border-4 border-slate-700 animate-fadeIn scale-100 transition-transform">
        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-red-500/30">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h1 className="text-3xl font-black mb-2 tracking-tight">Dados Apagados!</h1>
        <p className="text-slate-400 font-medium mb-8">
          Todo o seu progresso, hábitos e configurações salvos localmente foram excluídos com sucesso.
        </p>
        <div className="w-full flex justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        </div>
        <p className="text-xs text-slate-500 mt-4 font-bold uppercase tracking-widest">
          Redirecionando para o Início...
        </p>
      </div>
    </div>
  );
};

export default ResetAll;
