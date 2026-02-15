import { useEffect } from 'react';

const ResetNutrition = () => {
    useEffect(() => {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('produtivity_nutrition_')) {
                localStorage.removeItem(key);
            }
        });

        console.log('Todos os dados de nutrição e perfil foram limpos!');

        const timer = setTimeout(() => {
            window.location.href = '/';
        }, 1500);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
            <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl text-center border-2 border-slate-100 animate-fadeIn text-slate-800">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </div>
                <h1 className="text-2xl font-black mb-2 uppercase tracking-tighter">Limpando Tudo...</h1>
                <p className="text-slate-500 font-bold mb-6">Apagando seus dados e perfil nutricional para um novo começo com a Maria.</p>
                <div className="flex justify-center">
                    <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 animate-pulse" style={{ width: '100%' }}></div>
                    </div>
                </div>
                <p className="text-[10px] font-black uppercase text-slate-300 mt-8 tracking-widest">Aguarde, redirecionando...</p>
            </div>
        </div>
    );
};

export default ResetNutrition;
