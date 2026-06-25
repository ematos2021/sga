import { useState } from 'react';
import { useCollection, COL } from '../lib/store';
import { PageShell, Btn, Card, Field, Input, Select, Textarea, FormGrid, Modal, StatusBadge } from '../components/ui';
import { CALENDAR_CATEGORIES, isEventOnDate } from '../lib/constants';
import { 
    FaCalendarAlt, FaPlus, FaTrash, FaSearch, FaRegClock, FaGlobe, 
    FaFlag, FaUserTie, FaBuilding, FaInfoCircle, FaList, FaChevronLeft, 
    FaChevronRight, FaPlusCircle, FaStar
} from 'react-icons/fa';

const MONTHS_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function CalendarioAmbientalView({ onBack }) {
    const { items: events, add, remove } = useCollection(COL.CALENDARIO);
    
    // Default reference date: June 9, 2026
    const [currentMonth, setCurrentMonth] = useState(5); // Junho
    const [currentYear, setCurrentYear] = useState(2026);
    
    const [viewMode, setViewMode] = useState('grid'); // 'grid' ou 'list'
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [selectedDate, setSelectedDate] = useState({ dia: 9, mes: 6 }); // Dia de hoje padrão
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    
    // Estado para o formulário de novo evento
    const [newEvtDia, setNewEvtDia] = useState(9);
    const [newEvtMes, setNewEvtMes] = useState(6);
    const [newEvtTitulo, setNewEvtTitulo] = useState('');
    const [newEvtCategoria, setNewEvtCategoria] = useState('custom');
    const [newEvtObs, setNewEvtObs] = useState('');

    // Navegação de mês
    const prevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(prev => prev - 1);
        } else {
            setCurrentMonth(prev => prev - 1);
        }
    };

    const nextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(prev => prev + 1);
        } else {
            setCurrentMonth(prev => prev + 1);
        }
    };

    // Filtra eventos pela categoria ativa
    const filteredEvents = events.filter(evt => {
        const matchesCategory = selectedCategory === 'all' || evt.categoria === selectedCategory;
        const matchesSearch = searchQuery === '' || 
            evt.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (evt.obs && evt.obs.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    // Gera dias do mês para o grid
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayIndex = (year, month) => new Date(year, month, 1).getDay();

    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayIndex = getFirstDayIndex(currentYear, currentMonth);
    
    // Obter dias do mês anterior para preenchimento (padding)
    const prevMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonthIndex);
    
    const calendarDays = [];
    
    // Padding do mês anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        calendarDays.push({
            dia: daysInPrevMonth - i,
            mes: prevMonthIndex + 1,
            year: prevYear,
            isCurrentMonth: false
        });
    }
    
    // Dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
        calendarDays.push({
            dia: i,
            mes: currentMonth + 1,
            year: currentYear,
            isCurrentMonth: true
        });
    }
    
    // Padding do próximo mês para completar o grid (múltiplo de 7, totalizando 35 ou 42 células)
    const totalCellsNeeded = calendarDays.length <= 35 ? 35 : 42;
    const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    let nextDayPad = 1;
    while (calendarDays.length < totalCellsNeeded) {
        calendarDays.push({
            dia: nextDayPad++,
            mes: nextMonthIndex + 1,
            year: nextYear,
            isCurrentMonth: false
        });
    }

    // Ações para cadastrar evento customizado
    const handleAddEventSubmit = (e) => {
        e.preventDefault();
        if (!newEvtTitulo.trim()) return;
        
        const newEvent = {
            dia: Number(newEvtDia),
            mes: Number(newEvtMes),
            titulo: newEvtTitulo.trim(),
            categoria: newEvtCategoria,
            obs: newEvtObs.trim() || 'Cadastrado pelo usuário.',
            custom: true
        };
        
        add(newEvent);
        
        // Reset form e fechar modal
        setNewEvtTitulo('');
        setNewEvtObs('');
        setIsAddModalOpen(false);
    };

    // Eventos do dia selecionado
    const selectedEvents = events.filter(evt => isEventOnDate(evt, selectedDate.dia, selectedDate.mes));

    const getCategoryIcon = (cat) => {
        switch (cat) {
            case 'global': return <FaGlobe title="Global" />;
            case 'nacional': return <FaFlag title="Nacional" />;
            case 'profissional': return <FaUserTie title="Profissional" />;
            case 'institucional': return <FaBuilding title="Institucional" />;
            case 'periodo': return <FaRegClock title="Período" />;
            default: return <FaStar title="Customizado" />;
        }
    };

    return (
        <PageShell
            title="Calendário Ambiental"
            subtitle="Datas comemorativas ecológicas, marcos regulatórios e conformidade ISO 14001"
            icon={<FaCalendarAlt size={20} />}
            color="#10b981"
            onBack={onBack}
            actions={
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Btn 
                        color={viewMode === 'grid' ? '#10b981' : '#8b9bb4'} 
                        variant={viewMode === 'grid' ? 'solid' : 'outline'} 
                        onClick={() => setViewMode('grid')}
                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}
                    >
                        <FaCalendarAlt size={10} /> Grid Mensal
                    </Btn>
                    <Btn 
                        color={viewMode === 'list' ? '#10b981' : '#8b9bb4'} 
                        variant={viewMode === 'list' ? 'solid' : 'outline'} 
                        onClick={() => setViewMode('list')}
                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}
                    >
                        <FaList size={10} /> Lista Anual
                    </Btn>
                    <Btn 
                        color="#8b9bb4" 
                        variant="outline"
                        onClick={() => {
                            setNewEvtDia(selectedDate.dia);
                            setNewEvtMes(selectedDate.mes);
                            setIsAddModalOpen(true);
                        }}
                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem' }}
                    >
                        <FaPlus size={10} /> Novo Evento
                    </Btn>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                
                {/* FILTROS E PESQUISA */}
                <Card style={{ padding: '0.8rem 1.2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)', fontWeight: 700, textTransform: 'uppercase', marginRight: '0.4rem' }}>
                            Categorias:
                        </span>
                        <button 
                            onClick={() => setSelectedCategory('all')}
                            className={`filter-badge ${selectedCategory === 'all' ? 'active' : ''}`}
                            style={{ 
                                padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.06)',
                                cursor: 'pointer', background: selectedCategory === 'all' ? '#10b981' : 'rgba(255,255,255,0.03)',
                                color: selectedCategory === 'all' ? '#0f1014' : 'var(--color-text-main)', fontWeight: 600, transition: 'all 0.2s'
                            }}
                        >
                            Todos
                        </button>
                        {Object.keys(CALENDAR_CATEGORIES).map(key => {
                            const active = selectedCategory === key;
                            const cat = CALENDAR_CATEGORIES[key];
                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedCategory(key)}
                                    className={`filter-badge ${active ? 'active' : ''}`}
                                    style={{
                                        padding: '4px 10px', borderRadius: 20, fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.06)',
                                        cursor: 'pointer', background: active ? cat.color : 'rgba(255,255,255,0.03)',
                                        color: active ? '#0f1014' : 'var(--color-text-main)', fontWeight: 600,
                                        boxShadow: active ? `0 0 10px ${cat.color}44` : 'none', transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: active ? '#0f1014' : cat.color }} />
                                        {cat.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    
                    <div style={{ position: 'relative', minWidth: 260 }}>
                        <FaSearch size={12} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                        <input 
                            type="text" 
                            placeholder="Buscar datas e comemorações..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-dark"
                            style={{ paddingLeft: '2.1rem', fontSize: '0.78rem', width: '100%', height: 34 }}
                        />
                    </div>
                </Card>

                {viewMode === 'grid' ? (
                    /* VISUALIZAÇÃO EM GRID MENSAL E DETALHES LADO-A-LADO */
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '1rem', alignItems: 'start' }} className="calendar-split-layout">
                        
                        {/* CALENDÁRIO GRID */}
                        <Card style={{ padding: '1.2rem' }}>
                            {/* NAVEGAÇÃO DO MÊS */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                                <button onClick={prevMonth} className="btn-circle-nav" style={monthNavBtn}>
                                    <FaChevronLeft size={12} />
                                </button>
                                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '0.5px' }}>
                                    {MONTHS_NAMES[currentMonth]} {currentYear}
                                </h2>
                                <button onClick={nextMonth} className="btn-circle-nav" style={monthNavBtn}>
                                    <FaChevronRight size={12} />
                                </button>
                            </div>
                            
                            {/* DIAS DA SEMANA */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
                                {WEEKDAYS.map((day, idx) => (
                                    <span 
                                        key={day} 
                                        style={{ 
                                            fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', 
                                            color: idx === 0 || idx === 6 ? '#ff4757' : 'var(--color-text-muted)', 
                                            letterSpacing: '0.5px', padding: '6px 0' 
                                        }}
                                    >
                                        {day}
                                    </span>
                                ))}
                            </div>
                            
                            {/* DIAS DO MÊS */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '6px' }}>
                                {calendarDays.map((cell, idx) => {
                                    // Localizar eventos neste dia
                                    const dayEvents = events.filter(evt => isEventOnDate(evt, cell.dia, cell.mes));
                                    
                                    // Filtro de categoria e texto
                                    const visibleEvents = dayEvents.filter(evt => {
                                        const matchesCategory = selectedCategory === 'all' || evt.categoria === selectedCategory;
                                        const matchesSearch = searchQuery === '' || 
                                            evt.titulo.toLowerCase().includes(searchQuery.toLowerCase());
                                        return matchesCategory && matchesSearch;
                                    });
                                    
                                    const isSelected = selectedDate.dia === cell.dia && selectedDate.mes === cell.mes && cell.isCurrentMonth;
                                    const isToday = cell.dia === 9 && cell.mes === 6 && cell.year === 2026; // Data fixada no sistema
                                    
                                    // Estilo da borda
                                    let cellBorder = '1px solid rgba(255,255,255,0.03)';
                                    if (isSelected) cellBorder = '1px solid #10b981';
                                    else if (isToday) cellBorder = '1px solid rgba(0, 255, 157, 0.4)';
                                    
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (cell.isCurrentMonth) {
                                                    setSelectedDate({ dia: cell.dia, mes: cell.mes });
                                                } else {
                                                    // Navega para o mês correspondente se clicar fora
                                                    setCurrentMonth(cell.mes - 1);
                                                    setCurrentYear(cell.year);
                                                    setSelectedDate({ dia: cell.dia, mes: cell.mes });
                                                }
                                            }}
                                            style={{
                                                minHeight: '74px', padding: '6px', borderRadius: '10px',
                                                background: cell.isCurrentMonth 
                                                    ? (isToday ? 'rgba(0,255,157,0.04)' : 'rgba(20,23,33,0.3)')
                                                    : 'rgba(255,255,255,0.01)',
                                                border: cellBorder, cursor: 'pointer', transition: 'all 0.2s',
                                                display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative',
                                                opacity: cell.isCurrentMonth ? 1 : 0.4,
                                                minWidth: 0
                                            }}
                                            className="calendar-day-cell"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'none';
                                                e.currentTarget.style.background = cell.isCurrentMonth 
                                                    ? (isToday ? 'rgba(0,255,157,0.04)' : 'rgba(20,23,33,0.3)')
                                                    : 'rgba(255,255,255,0.01)';
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontSize: '0.78rem', fontWeight: isToday || isSelected ? 800 : 500,
                                                    color: isToday ? '#00ff9d' : 'var(--color-text-main)',
                                                    background: isToday ? 'rgba(0,255,157,0.15)' : 'transparent',
                                                    width: 20, height: 20, borderRadius: '50%', display: 'flex',
                                                    alignItems: 'center', justifyContent: 'center'
                                                }}>
                                                    {cell.dia}
                                                </span>
                                                {isToday && (
                                                    <span style={{ fontSize: '0.52rem', textTransform: 'uppercase', color: '#00ff9d', fontWeight: 700, letterSpacing: '0.5px' }}>
                                                        Hoje
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* LISTA DE EVENTOS DO DIA (DENTRO DA CÉLULA) */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflow: 'hidden' }}>
                                                {visibleEvents.slice(0, 2).map((evt, eIdx) => {
                                                    const catColor = CALENDAR_CATEGORIES[evt.categoria]?.color || '#8b9bb4';
                                                    return (
                                                        <div 
                                                            key={eIdx}
                                                            style={{
                                                                fontSize: '0.56rem', padding: '2px 4px', borderRadius: 4,
                                                                background: catColor + '1c', color: catColor,
                                                                borderLeft: `2px solid ${catColor}`, whiteSpace: 'nowrap',
                                                                textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 600
                                                            }}
                                                            title={evt.titulo}
                                                        >
                                                            {evt.titulo}
                                                        </div>
                                                    );
                                                })}
                                                {visibleEvents.length > 2 && (
                                                    <div style={{ fontSize: '0.52rem', color: 'var(--color-text-subtle)', fontStyle: 'italic', paddingLeft: 4 }}>
                                                        + {visibleEvents.length - 2} mais
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>
                        
                        {/* PAINEL DE DETALHES LATERAL */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <Card style={{ borderLeft: '3px solid #10b981' }}>
                                <div style={{ marginBottom: '0.8rem' }}>
                                    <span style={{ fontSize: '0.64rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Eventos Selecionados
                                    </span>
                                    <h3 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                                        {selectedDate.dia} de {MONTHS_NAMES[selectedDate.mes - 1]}
                                    </h3>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', minHeight: 180, maxHeight: 380, overflowY: 'auto' }}>
                                    {selectedEvents.length === 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--color-text-muted)', gap: '0.5rem' }}>
                                            <FaInfoCircle size={24} style={{ opacity: 0.4 }} />
                                            <span style={{ fontSize: '0.74rem', textAlign: 'center' }}>Nenhum evento registrado nesta data.</span>
                                            <Btn 
                                                color="#10b981" 
                                                variant="outline" 
                                                onClick={() => {
                                                    setNewEvtDia(selectedDate.dia);
                                                    setNewEvtMes(selectedDate.mes);
                                                    setIsAddModalOpen(true);
                                                }}
                                                style={{ fontSize: '0.7rem', padding: '0.35rem 0.6rem', marginTop: '0.3rem' }}
                                            >
                                                <FaPlusCircle size={10} /> Adicionar
                                            </Btn>
                                        </div>
                                    ) : (
                                        selectedEvents.map((evt) => {
                                            const cat = CALENDAR_CATEGORIES[evt.categoria] || CALENDAR_CATEGORIES.custom;
                                            return (
                                                <div 
                                                    key={evt.id} 
                                                    style={{ 
                                                        padding: '0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.02)',
                                                        border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '0.35rem'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.5rem' }}>
                                                        <span style={{
                                                            fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                                            background: cat.color + '15', color: cat.color, border: `1px solid ${cat.color}33`,
                                                            display: 'inline-flex', alignItems: 'center', gap: '4px'
                                                        }}>
                                                            {getCategoryIcon(evt.categoria)}
                                                            {cat.label}
                                                        </span>
                                                        {evt.custom && (
                                                            <button 
                                                                onClick={() => remove(evt.id)}
                                                                title="Excluir evento customizado"
                                                                style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', padding: '0.2rem' }}
                                                            >
                                                                <FaTrash size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-main)', lineHeight: 1.3 }}>
                                                        {evt.titulo}
                                                    </h4>
                                                    {evt.obs && (
                                                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-subtle)', lineHeight: 1.3 }}>
                                                            {evt.obs}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </Card>
                            
                            <Card style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), transparent)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                                    <FaInfoCircle size={14} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                                    <div>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.76rem', fontWeight: 700, color: 'var(--color-text-main)' }}>Práticas ISO 14001</h4>
                                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-subtle)', lineHeight: 1.3 }}>
                                            As datas comemorativas ambientais auxiliam a equipe do SGI no planejamento de campanhas de DDS (Diálogo Diário de Segurança) e conscientização ambiental periódica.
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                ) : (
                    /* LISTA ANUAL COMPLETA / LINHA DO TEMPO */
                    <Card style={{ padding: '1.5rem' }}>
                        <div style={{ marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                                Cronograma Anual Completo ({filteredEvents.length} eventos filtrados)
                            </h3>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-subtle)' }}>
                                Ordenado cronologicamente de Janeiro a Dezembro
                            </span>
                        </div>
                        
                        {filteredEvents.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
                                Nenhum evento ambiental corresponde aos critérios de busca ou filtros ativos.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {MONTHS_NAMES.map((mesNome, mIdx) => {
                                    const mesEventos = filteredEvents.filter(e => e.mes === mIdx + 1).sort((a, b) => a.dia - b.dia);
                                    if (mesEventos.length === 0) return null;
                                    
                                    return (
                                        <div key={mesNome} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.8rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                                    {mesNome}
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {mesEventos.map((evt, idx) => {
                                                    const catColor = CALENDAR_CATEGORIES[evt.categoria]?.color || '#8b9bb4';
                                                    return (
                                                        <div 
                                                            key={idx}
                                                            style={{ 
                                                                display: 'flex', gap: '1rem', alignItems: 'center', 
                                                                background: 'rgba(255,255,255,0.01)', padding: '0.5rem 0.8rem', 
                                                                borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)'
                                                            }}
                                                        >
                                                            <div style={{ 
                                                                width: 32, height: 32, borderRadius: 8, background: catColor + '1a',
                                                                color: catColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.78rem', fontWeight: 800, flexShrink: 0
                                                            }}>
                                                                {evt.dia}
                                                            </div>
                                                            <div style={{ flex: 1 }}>
                                                                <h4 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                                                    {evt.titulo}
                                                                </h4>
                                                                {evt.obs && (
                                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.68rem', color: 'var(--color-text-subtle)' }}>
                                                                        {evt.obs}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{
                                                                    fontSize: '0.58rem', fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                                                    background: catColor + '10', color: catColor, border: `1px solid ${catColor}22`
                                                                }}>
                                                                    {CALENDAR_CATEGORIES[evt.categoria]?.label || 'Custom'}
                                                                </span>
                                                                {evt.custom && (
                                                                    <button 
                                                                        onClick={() => remove(evt.id)}
                                                                        style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', padding: '0.2rem' }}
                                                                        title="Excluir evento"
                                                                    >
                                                                        <FaTrash size={10} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                )}
            </div>

            {/* MODAL DE CRIAÇÃO DE EVENTO CUSTOMIZADO */}
            {isAddModalOpen && (
                <Modal title="Agendar Novo Evento Ambiental" onClose={() => setIsAddModalOpen(false)}>
                    <form onSubmit={handleAddEventSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <FormGrid cols={2}>
                            <Field label="Dia" required>
                                <Input 
                                    type="number" 
                                    min="1" 
                                    max="31" 
                                    value={newEvtDia} 
                                    onChange={(e) => setNewEvtDia(e.target.value)} 
                                    required 
                                />
                            </Field>
                            <Field label="Mês" required>
                                <Select 
                                    value={newEvtMes} 
                                    onChange={(e) => setNewEvtMes(e.target.value)} 
                                    required
                                >
                                    {MONTHS_NAMES.map((nome, idx) => (
                                        <option key={idx} value={idx + 1}>{nome}</option>
                                    ))}
                                </Select>
                            </Field>
                        </FormGrid>

                        <Field label="Título da Homenagem / Evento" required>
                            <Input 
                                type="text" 
                                placeholder="Ex: DDS Especial sobre Resíduos Perigosos" 
                                value={newEvtTitulo} 
                                onChange={(e) => setNewEvtTitulo(e.target.value)} 
                                required 
                            />
                        </Field>

                        <Field label="Categoria de Evento" required>
                            <Select 
                                value={newEvtCategoria} 
                                onChange={(e) => setNewEvtCategoria(e.target.value)} 
                                required
                            >
                                {Object.keys(CALENDAR_CATEGORIES).map(key => (
                                    <option key={key} value={key}>{CALENDAR_CATEGORIES[key].label}</option>
                                ))}
                            </Select>
                        </Field>

                        <Field label="Observações / Descrição do Evento">
                            <Textarea 
                                placeholder="Descreva os objetivos, as ações planejadas para este dia ou dados normativos..." 
                                value={newEvtObs} 
                                onChange={(e) => setNewEvtObs(e.target.value)} 
                                rows={3}
                            />
                        </Field>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                            <Btn color="#ff4757" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                                Cancelar
                            </Btn>
                            <Btn color="#10b981" type="submit" variant="solid">
                                <FaPlus size={10} /> Salvar Evento
                            </Btn>
                        </div>
                    </form>
                </Modal>
            )}
        </PageShell>
    );
}

const monthNavBtn = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    color: 'var(--color-text-main)',
    width: 30,
    height: 30,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s'
};
