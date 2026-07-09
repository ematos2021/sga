import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { applyThemeClass, getStoredTheme } from './components/ThemePicker';
import { seedIfEmpty } from './lib/seed';
import { FaLeaf } from 'react-icons/fa';

import LoginPage from './pages/LoginPage';
import MainMenu from './pages/MainMenu';
import DashboardAmbiental from './pages/DashboardAmbiental';
import AutorizacaoSaidaView from './pages/AutorizacaoSaidaView';
import ControleResiduosView from './pages/ControleResiduosView';
import ManifestoMTRView from './pages/ManifestoMTRView';
import TicketsColetaView from './pages/TicketsColetaView';
import FumacaPretaView from './pages/FumacaPretaView';
import ESGCarbonoView from './pages/ESGCarbonoView';
import NFSucataView from './pages/NFSucataView';
import MotoristasView from './pages/MotoristasView';
import CadastrosView from './pages/CadastrosView';
import CalendarioAmbientalView from './pages/CalendarioAmbientalView';
import FichaResiduosView from './pages/FichaResiduosView';
import UsuariosView from './pages/UsuariosView';
import LiraView from './pages/LiraView';
import DedetizacaoView from './pages/DedetizacaoView';


function App() {
    const { currentUser, logout, isLoading } = useAuth();
    const [view, setView] = useState('login');

    useEffect(() => { seedIfEmpty(); }, []);

    useEffect(() => {
        applyThemeClass(getStoredTheme(currentUser));
    }, [currentUser?.theme, currentUser?.username]);

    useEffect(() => {
        if (currentUser && view === 'login') setView('main-menu');
    }, [currentUser, view]);

    if (isLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', gap: '1rem' }}>
                <FaLeaf size={48} color="#00ff9d" style={{ animation: 'pulse 1.5s infinite' }} />
                <span style={{ color: '#666', fontSize: '0.9rem', letterSpacing: '3px' }}>SGA</span>
            </div>
        );
    }

    if (!currentUser || view === 'login') {
        return <LoginPage onLoginSuccess={() => setView('main-menu')} />;
    }

    if (view === 'main-menu') {
        return <MainMenu onNavigate={setView} onLogout={() => { logout(); setView('login'); }} />;
    }

    const back = () => setView('main-menu');

    const canAccess = (pageId) => {
        if (!currentUser) return false;
        if (currentUser.allowed_pages === 'all') return true;
        return (currentUser.allowed_pages || []).includes(pageId);
    };

    const guardedView = (pageId, Component, props = {}) => {
        if (!canAccess(pageId)) {
            // Redireciona para o menu principal se não tem permissão
            setTimeout(() => setView('main-menu'), 0);
            return null;
        }
        return <Component {...props} />;
    };

    return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)', overflow: 'hidden' }}>
            <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {view === 'dashboard' && guardedView('dashboard', DashboardAmbiental, { onBack: back, onNavigate: setView })}
                {view === 'autorizacoes' && guardedView('autorizacoes', AutorizacaoSaidaView, { onBack: back })}
                {view === 'controle-residuos' && guardedView('controle-residuos', ControleResiduosView, { onBack: back })}
                {view === 'manifestos' && guardedView('manifestos', ManifestoMTRView, { onBack: back })}
                {view === 'tickets' && guardedView('tickets', TicketsColetaView, { onBack: back })}
                {view === 'fumaca' && guardedView('fumaca', FumacaPretaView, { onBack: back })}
                {view === 'lira' && guardedView('lira', LiraView, { onBack: back })}
                {view === 'dedetizacao' && guardedView('dedetizacao', DedetizacaoView, { onBack: back })}
                {view === 'esg-carbono' && guardedView('esg-carbono', ESGCarbonoView, { onBack: back })}
                {view === 'nf-sucata' && guardedView('nf-sucata', NFSucataView, { onBack: back })}
                {view === 'motoristas' && guardedView('motoristas', MotoristasView, { onBack: back })}
                {view === 'cadastros' && guardedView('cadastros', CadastrosView, { onBack: back })}
                {view === 'ficha-residuos' && guardedView('ficha-residuos', FichaResiduosView, { onBack: back })}
                {view === 'usuarios' && (currentUser?.is_admin ? <UsuariosView onBack={back} /> : (() => { setTimeout(() => setView('main-menu'), 0); return null; })())}
                {view === 'calendario' && guardedView('calendario', CalendarioAmbientalView, { onBack: back })}
            </main>
        </div>
    );
}

export default App;
