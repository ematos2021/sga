import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FaLeaf, FaUser, FaLock, FaArrowRight, FaEye, FaEyeSlash } from 'react-icons/fa';

function LoginPage({ onLoginSuccess }) {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [verSenha, setVerSenha] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setCarregando(true);
        const res = await login(username, password);
        setCarregando(false);
        if (res.ok) onLoginSuccess();
        else setError(res.error);
    };

    return (
        <div className="main-menu-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: 400, padding: '2.5rem 2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 18, margin: '0 auto 1rem',
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-success))', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px color-mix(in srgb, var(--color-primary) 30%, transparent)',
                    }}>
                        <FaLeaf size={30} color="var(--color-on-accent)" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-main)' }}>SGA</h1>
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', color: 'var(--color-text-muted)' }}>
                        Sistema de Gestão Ambiental
                    </p>
                    <p style={{ margin: '0.9rem 0 0', fontSize: '0.84rem', color: 'var(--color-text-subtle)' }}>
                        Entre com seu e-mail e senha para continuar.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label className="label-muted">E-mail</label>
                        <div style={{ position: 'relative' }}>
                            <FaUser size={13} style={iconInside} />
                            <input className="input-dark" style={{ paddingLeft: '2.5rem' }} value={username}
                                onChange={(e) => setUsername(e.target.value)} placeholder="voce@empresa.com" autoFocus />
                        </div>
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="label-muted">Senha</label>
                        <div style={{ position: 'relative' }}>
                            <FaLock size={13} style={iconInside} />
                            <input className="input-dark" style={{ paddingLeft: '2.5rem', paddingRight: '2.8rem' }} type={verSenha ? 'text' : 'password'} value={password}
                                onChange={(e) => setPassword(e.target.value)} placeholder="••••" />
                            <button type="button" onClick={() => setVerSenha((v) => !v)} title={verSenha ? 'Esconder senha' : 'Mostrar senha'} aria-label={verSenha ? 'Esconder senha' : 'Mostrar senha'}
                                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, border: 'none', background: 'transparent', color: 'var(--color-text-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                                {verSenha ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{ marginBottom: '1rem', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontSize: '0.8rem' }}>
                            {error}
                        </div>
                    )}

                    <button type="submit" disabled={carregando} className="btn-touch btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '0.95rem', opacity: carregando ? 0.7 : 1 }}>
                        {carregando ? 'Entrando…' : <>Entrar <FaArrowRight size={14} /></>}
                    </button>
                </form>


            </div>
        </div>
    );
}

const iconInside = {
    position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)',
    color: 'var(--color-text-subtle)', pointerEvents: 'none',
};

export default LoginPage;
