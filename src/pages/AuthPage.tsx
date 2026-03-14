/**
 * AuthPage.tsx
 *
 * Tela de login / cadastro com design premium.
 * Consistente com o visual do app (sidebar azul/vermelha, font Plus Jakarta Sans).
 */

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AuthPageProps {
  isDarkMode: boolean;
  onToggleDark: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ isDarkMode, onToggleDark }) => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const brandBg = isDarkMode ? 'bg-red-600' : 'bg-[#4A69A2]';
  const brandText = isDarkMode ? 'text-red-500' : 'text-[#4A69A2]';
  const brandBorder = isDarkMode ? 'border-red-500/30' : 'border-[#4A69A2]/30';
  const brandHover = isDarkMode ? 'hover:bg-red-700' : 'hover:bg-[#3d5a8f]';
  const brandFocusRing = isDarkMode ? 'focus:ring-red-500/40' : 'focus:ring-[#4A69A2]/40';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email, password);
        if (err) setError(err.message);
      } else {
        if (!displayName.trim()) {
          setError('Por favor, informe seu nome.');
          setLoading(false);
          return;
        }
        const { error: err } = await signUp(email, password, displayName.trim());
        if (err) {
          setError(err.message);
        } else {
          setSignupSuccess(true);
        }
      }
    } catch {
      setError('Ocorreu um erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setSignupSuccess(false);
  };

  // Traduz mensagens de erro comuns
  const translateError = (msg: string): string => {
    if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos.';
    if (msg.includes('User already registered')) return 'Este email já está cadastrado.';
    if (msg.includes('Password should be at least')) return 'A senha deve ter no mínimo 6 caracteres.';
    if (msg.includes('Unable to validate email')) return 'Email inválido.';
    if (msg.includes('Email rate limit exceeded')) return 'Muitas tentativas. Aguarde alguns minutos.';
    if (msg.includes('Signup requires a valid password')) return 'Informe uma senha válida.';
    return msg;
  };

  if (signupSuccess) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-4 transition-colors duration-500 ${isDarkMode ? 'bg-black' : 'bg-slate-50'}`}>
        <div className={`w-full max-w-md text-center animate-fadeIn`}>
          {/* Success icon */}
          <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl ${brandBg} flex items-center justify-center shadow-2xl`}>
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className={`text-2xl font-black tracking-tight mb-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Conta criada com sucesso!
          </h2>
          <p className={`text-sm mb-8 leading-relaxed ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
            Enviamos um link de confirmação para <span className="font-bold">{email}</span>.
            <br />Verifique sua caixa de entrada e spam.
          </p>
          <button
            onClick={() => {
              setSignupSuccess(false);
              setMode('login');
            }}
            className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 ${brandBg} ${brandHover} hover:shadow-xl active:scale-[0.98]`}
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-500 ${isDarkMode ? 'bg-black' : 'bg-slate-50'}`}>

      {/* ─── Left panel (branding) ─── */}
      <div className={`relative overflow-hidden lg:w-[45%] xl:w-[40%] ${brandBg} flex flex-col justify-between p-8 lg:p-12`}>
        {/* Grid background pattern */}
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />

        {/* Floating decorative circles */}
        <div className="absolute top-20 right-10 w-32 h-32 rounded-full bg-white/5 blur-xl" />
        <div className="absolute bottom-32 left-8 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-full bg-white/10 blur-lg" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-2.5 rounded-xl ring-1 ring-white/30 shadow-xl">
              <img src="/logo.png" alt="Logo" className="w-6 h-6 object-contain" />
            </div>
            <span className="text-white text-2xl font-black tracking-tight lowercase">
              produtivity
            </span>
          </div>
        </div>

        {/* Tagline area - hidden on mobile, visible on desktop */}
        <div className="relative z-10 hidden lg:block">
          <h1 className="text-white text-4xl xl:text-5xl font-black leading-[1.1] tracking-tight mb-6">
            Organize.
            <br />
            Estude.
            <br />
            <span className="opacity-60">Evolua.</span>
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-sm">
            Gerencie seus estudos, rotinas, hábitos, finanças e nutrição — tudo em um só lugar.
          </p>
        </div>

        {/* Bottom decoration */}
        <div className="relative z-10 hidden lg:flex items-center gap-2 mt-8">
          <div className="w-8 h-1 rounded-full bg-white/30" />
          <div className="w-3 h-1 rounded-full bg-white/15" />
          <div className="w-2 h-1 rounded-full bg-white/10" />
        </div>
      </div>

      {/* ─── Right panel (form) ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Dark mode toggle */}
          <div className="flex justify-end mb-6 lg:mb-10">
            <button
              onClick={onToggleDark}
              className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}
              title={isDarkMode ? 'Modo claro' : 'Modo escuro'}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
              {mode === 'login'
                ? 'Entre na sua conta para continuar'
                : 'Cadastre-se para sincronizar seus dados'
              }
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className={`mb-6 p-4 rounded-2xl text-sm font-medium animate-fadeIn flex items-center gap-3 ${isDarkMode ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6m0-6l6 6" />
              </svg>
              {translateError(error)}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="animate-fadeIn">
                <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                  Seu nome
                </label>
                <div className="relative">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    id="auth-display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl text-sm font-medium transition-all duration-300 outline-none ring-2 ring-transparent focus:ring-2 ${brandFocusRing} ${isDarkMode
                      ? 'bg-slate-900 text-white placeholder:text-white/20 border border-slate-800'
                      : 'bg-white text-slate-900 placeholder:text-slate-300 border border-slate-200'
                    }`}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                Email
              </label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className={`w-full pl-12 pr-4 py-4 rounded-2xl text-sm font-medium transition-all duration-300 outline-none ring-2 ring-transparent focus:ring-2 ${brandFocusRing} ${isDarkMode
                    ? 'bg-slate-900 text-white placeholder:text-white/20 border border-slate-800'
                    : 'bg-white text-slate-900 placeholder:text-slate-300 border border-slate-200'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>
                Senha
              </label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </span>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className={`w-full pl-12 pr-12 py-4 rounded-2xl text-sm font-medium transition-all duration-300 outline-none ring-2 ring-transparent focus:ring-2 ${brandFocusRing} ${isDarkMode
                    ? 'bg-slate-900 text-white placeholder:text-white/20 border border-slate-800'
                    : 'bg-white text-slate-900 placeholder:text-slate-300 border border-slate-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all hover:scale-110 ${isDarkMode ? 'text-white/30 hover:text-white/60' : 'text-slate-300 hover:text-slate-500'}`}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold text-white text-sm transition-all duration-300 mt-2 ${brandBg} ${brandHover} hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Aguarde...
                </>
              ) : (
                mode === 'login' ? 'Entrar' : 'Criar conta'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8">
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <span className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>
              ou
            </span>
            <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />
          </div>

          {/* Switch mode */}
          <button
            onClick={switchMode}
            className={`w-full py-4 rounded-2xl text-sm font-bold transition-all duration-300 hover:shadow-lg active:scale-[0.98] ${isDarkMode
              ? `bg-slate-900 border ${brandBorder} ${brandText} hover:bg-slate-800`
              : `bg-white border ${brandBorder} ${brandText} hover:bg-slate-50`
            }`}
          >
            {mode === 'login'
              ? 'Não tem conta? Cadastre-se'
              : 'Já tem conta? Entrar'
            }
          </button>

          {/* Skip / Continue without account */}
          <p className={`text-center text-xs mt-6 ${isDarkMode ? 'text-white/20' : 'text-slate-300'}`}>
            Os dados ficarão sincronizados na nuvem após o login.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
