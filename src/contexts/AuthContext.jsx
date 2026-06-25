import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const ROLE_LABELS = {
    gestor: 'Gestor Ambiental',
    analista: 'Analista Ambiental',
    operador: 'Operador',
};

// Monta o objeto de usuário do app a partir da sessão do Supabase Auth + profile
async function montarUsuario(authUser) {
    let prof = null;
    try {
        const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
        prof = data;
    } catch { /* tabela pode não existir ainda */ }

    // Carrega permissões de tela do usuário
    let allowed_pages = [];
    const isAdmin = !!prof?.is_admin;
    if (isAdmin) {
        allowed_pages = 'all'; // Admin tem acesso total
    } else {
        try {
            const { data: perms } = await supabase
                .from('user_permissions')
                .select('page_id')
                .eq('user_id', authUser.id);
            allowed_pages = (perms || []).map((p) => p.page_id);
        } catch { /* tabela pode não existir ainda */ }
    }

    return {
        id: authUser.id,
        email: authUser.email,
        username: authUser.email,
        name: prof?.name || authUser.user_metadata?.name || authUser.email,
        role: prof?.role || 'analista',
        avatar: prof?.avatar || '👤',
        is_admin: isAdmin,
        active: prof?.active !== false,
        allowed_pages,
        theme: localStorage.getItem('sga_theme') || 'onyx',
        _supabase: true,
    };
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let ativo = true;
        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    const u = await montarUsuario(session.user);
                    if (ativo) setCurrentUser(u);
                }
            } catch { /* ignore */ }
            if (ativo) setIsLoading(false);
        })();

        const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
            if (session?.user) {
                const u = await montarUsuario(session.user);
                if (ativo) setCurrentUser(u);
            }
        });
        return () => { ativo = false; sub?.subscription?.unsubscribe(); };
    }, []);

    const login = async (login, password) => {
        const email = (login || '').trim();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data?.user) {
            const u = await montarUsuario(data.user);
            setCurrentUser(u);
            return { ok: true };
        }
        return { ok: false, error: error?.message || 'Usuário ou senha inválidos.' };
    };

    const logout = async () => {
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
        setCurrentUser(null);
    };

    // Recarrega as permissões do usuário atual (útil após admin editar)
    const reloadPermissions = async () => {
        if (!currentUser?._supabase) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const u = await montarUsuario(session.user);
            setCurrentUser(u);
        }
    };

    const updateUser = (_id, patch) => {
        setCurrentUser((prev) => {
            const next = { ...prev, ...patch };
            if (patch.theme) localStorage.setItem('sga_theme', patch.theme);
            return next;
        });
    };

    return (
        <AuthContext.Provider value={{ currentUser, isLoading, login, logout, updateUser, reloadPermissions, ROLE_LABELS }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
