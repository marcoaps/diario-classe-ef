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
    <div className='min-h-screen flex flex-col items-center justify-center' style={{ background: 'linear-gradient(160deg, #EAFBF3 0%, #CDF3DE 55%, #A9EAC8 100%)' }}>
      <div className='relative z-10 w-full max-w-sm mx-4'>
        <div className='flex flex-col items-center mb-8'>
          <img src='/Logo_IOP.png' alt='Logo' className='w-28 h-28 rounded-full object-cover mb-4 border-4 border-white shadow-lg' />
          <h1 className='text-[#053B20] text-2xl font-black text-center'>Instituto Odilon Pratagi</h1>
          <p className='text-[#0B7A3D]/70 text-sm mt-1 tracking-widest uppercase'>Escola Estadual · Brasiléia - AC</p>
          <div className='mt-3 px-4 py-1 rounded-full bg-white/60 border border-white'>
            <p className='text-[#0B7A3D] text-xs font-semibold'>📚 Diário de Classe Digital</p>
          </div>
        </div>
        <div className='bg-white rounded-3xl p-6 shadow-xl shadow-emerald-900/10'>
          <h2 className='text-[#0B2E1B] text-lg font-bold mb-1'>Bem-vindo, Professor!</h2>
          <p className='text-gray-400 text-sm mb-6'>Faça login para acessar o diário.</p>
          <form onSubmit={handleLogin} className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1.5'>
              <label className='text-gray-400 text-xs font-semibold uppercase'>E-mail</label>
              <div className='relative'>
                <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300' />
                <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} placeholder='professor@iop.edu.br' required className='w-full bg-[#F3FBF6] border border-[#DDF3E6] rounded-xl pl-10 pr-4 py-3 text-[#0B2E1B] placeholder-gray-300 text-sm outline-none focus:border-[#0B7A3D] transition-all' />
              </div>
            </div>
            <div className='flex flex-col gap-1.5'>
              <label className='text-gray-400 text-xs font-semibold uppercase'>Senha</label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300' />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder='••••••••' required className='w-full bg-[#F3FBF6] border border-[#DDF3E6] rounded-xl pl-10 pr-10 py-3 text-[#0B2E1B] placeholder-gray-300 text-sm outline-none focus:border-[#0B7A3D] transition-all' />
                <button type='button' onClick={() => setShowPassword(!showPassword)} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-300'>
                  {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                </button>
              </div>
            </div>
            {error && <div className='bg-red-50 border border-red-100 rounded-xl px-4 py-3'><p className='text-red-500 text-sm'>{error}</p></div>}
            <button type='submit' disabled={loading} className='mt-2 w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-900/20' style={{ background: 'linear-gradient(135deg,#0B7A3D,#149951)' }}>
              {loading ? <><div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />Entrando...</> : <><LogIn className='w-4 h-4' />Entrar</>}
            </button>
          </form>
        </div>
        <p className='text-center text-[#0B7A3D]/40 text-xs mt-6'>Desde 1934 · Instituto Odilon Pratagi</p>
      </div>
    </div>
  );
}
