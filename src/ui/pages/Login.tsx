import React, { useState } from 'react';
import { supabase } from '../../data/supabase';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError('E-mail ou senha incorretos.');
        return;
      }
      // Aguarda a sessão ser persistida no localStorage antes de navegar
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      navigate('/');
    } catch {
      setError('Erro ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-[#0a1628]'>
      <div className='relative z-10 w-full max-w-sm mx-4'>
        <div className='flex flex-col items-center mb-8'>
          <img src='/Logo_IOP.png' alt='Logo' className='w-28 h-28 rounded-full object-cover mb-4 border-4 border-white/10' />
          <h1 className='text-white text-2xl font-black text-center'>Instituto Odilon Pratagi</h1>
          <p className='text-blue-300/70 text-sm mt-1 tracking-widest uppercase'>Escola Estadual · Brasiléia - AC</p>
          <div className='mt-3 px-4 py-1 rounded-full bg-white/5 border border-white/10'>
            <p className='text-white/50 text-xs'>📚 Diário de Classe Digital</p>
          </div>
        </div>
        <div className='bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl'>
          <h2 className='text-white text-lg font-bold mb-1'>Bem-vindo, Professor!</h2>
          <p className='text-white/40 text-sm mb-6'>Faça login para acessar o diário.</p>
          <form onSubmit={handleLogin} className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1.5'>
              <label className='text-white/60 text-xs font-semibold uppercase'>E-mail</label>
              <div className='relative'>
                <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30' />
                <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='professor@iop.edu.br' required className='w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-blue-500 transition-all' />
              </div>
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-white/60 text-xs font-semibold uppercase'>Senha</label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30' />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder='••••••••' required className='w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-blue-500 transition-all' />
                <button type='button' onClick={() => setShowPassword(!showPassword)} className='absolute right-3 top-1/2 -translate-y-1/2 text-white/30'>
                  {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                </button>
              </div>
            </div>
            {error && <div className='bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3'><p className='text-red-400 text-sm'>{error}</p></div>}
            <button type='submit' disabled={loading} className='mt-2 w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50' style={{ background: 'linear-gradient(135deg,#1a3a7c,#3b6fd4)' }}>
              {loading ? <><div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />Entrando...</> : <><LogIn className='w-4 h-4' />Entrar</>}
            </button>
          </form>
        </div>
        <p className='text-center text-white/20 text-xs mt-6'>Desde 1934 · Instituto Odilon Pratagi</p>
      </div>
    </div>
  );
}
