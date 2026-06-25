// ════════════════════════════════════════════════════════════════
//  Constantes do domínio ambiental (base ISO 14001 / NBR 10004 / SINIR)
// ════════════════════════════════════════════════════════════════

// Classificação NBR 10004
export const CLASSES_RESIDUO = [
    { id: 'I', label: 'Classe I — Perigoso', color: '#ff4757' },
    { id: 'IIA', label: 'Classe II A — Não Inerte', color: '#ffb700' },
    { id: 'IIB', label: 'Classe II B — Inerte', color: '#10b981' },
];

export const ESTADOS_FISICOS = ['Sólido', 'Líquido', 'Pastoso', 'Gasoso'];

export const UNIDADES = ['kg', 'ton', 'L', 'm³', 'unidade', 'tambor', 'bombona'];

export const TIPOS_DESTINACAO = [
    'Reciclagem',
    'Reutilização',
    'Coprocessamento',
    'Compostagem',
    'Incineração',
    'Aterro Industrial',
    'Aterro Sanitário',
    'Tratamento',
];

// Escala de Ringelmann — densidade de fumaça preta (CONAMA / NBR 6016)
// Limite legal: máx. grau 2 (40%), exceto 5s contínuos na partida (grau 3)
export const RINGELMANN = [
    { grau: 0, label: 'Grau 0 — 0% (Incolor)', pct: '0%', color: '#10b981', ok: true },
    { grau: 1, label: 'Grau 1 — 20%', pct: '20%', color: '#84cc16', ok: true },
    { grau: 2, label: 'Grau 2 — 40% (Limite)', pct: '40%', color: '#ffb700', ok: true },
    { grau: 3, label: 'Grau 3 — 60%', pct: '60%', color: '#ff9f43', ok: false },
    { grau: 4, label: 'Grau 4 — 80%', pct: '80%', color: '#ff4757', ok: false },
    { grau: 5, label: 'Grau 5 — 100% (Total)', pct: '100%', color: '#7f1d1d', ok: false },
];

// ─── Medição de Fumaça Preta (FR 658) ───
// Tipos de injeção dos geradores
export const INJECAO_TIPOS = ['Semielétrica', 'Eletrônica'];
// Fases da medição
export const FASES_MEDICAO = ['Ignição', 'Carga'];
// Padrões apurados possíveis (Escala Ringelmann Reduzida)
export const PADROES_APURADOS = [0, 20, 40, 60, 80, 100];

// Limite legal: até grau 2 (40%) é tolerado. Acima de 40% = não conforme.
export function apuradoInfo(pct) {
    const p = Number(pct);
    if (p <= 20) return { color: '#10b981', conforme: true, label: 'Conforme' };
    if (p === 40) return { color: '#ffb700', conforme: true, label: 'Limite legal' };
    return { color: '#ff4757', conforme: false, label: 'Não conforme' };
}
export function pctToGrau(pct) {
    return PADROES_APURADOS.indexOf(Number(pct)); // 0%→0, 20%→1, ...
}

// Cabeçalho padrão do relatório FR 658
export const FR658_DEFAULTS = {
    numeroFR: 'FR 658',
    revisao: '00',
    revData: 'Fevereiro 2023',
    empresa: 'Grupo MK',
    referenciaNormativa: 'NBR ISO 14001:2015\nPortaria Federal IBAMA nº 85 de 17/10/1996\nABNT NBR 6016:1986',
    metodo: 'Ensaio com Escala Ringelmann Reduzida',
    fonte: 'Geradores (motor Scania/óleo diesel, 550 hp)',
    descricaoMetodo:
        'Os geradores foram ligados um a um para a medição da emissão de fumaça preta no momento da ignição.\n\n' +
        'Após a verificação do grau de enegrecimento da fumaça emitida pelos geradores utilizando a Escala Ringelmann (datada de 2023) no momento da ignição, os geradores foram ligados simultaneamente para verificação da emissão da fumaça no funcionamento dos geradores com carga.\n\n' +
        'A Escala de Ringelmann foi segurada com o braço esticado a uma distância média de 30 m do escapamento dos geradores. Avaliou-se o grau de enegrecimento dos gases do escapamento, através do orifício da Escala, contra um fundo claro e verificado qual dos padrões da Escala mais se assemelhou à tonalidade dos gases emitidos. Os resultados das medições estão registrados neste Relatório bem como as fotos que demonstram a fumaça emitida pelos geradores.',
    cargoElaborador: 'Analista Ambiental – Sistema de Gestão Integrado',
};

// Status dos fluxos
export const STATUS_AUTORIZACAO = ['Pendente', 'Autorizada', 'Liberada', 'Recusada'];
export const STATUS_MANIFESTO = ['Emitido', 'Aguardando Emissão'];
export const STATUS_TICKET = ['Aguardando Coleta', 'Coletado', 'Conferido'];
export const STATUS_NF = ['Emitida', 'Enviada', 'Faturada', 'Paga'];

// Dias úteis de operação (segunda a sábado)
export const DIAS_OPERACAO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const SINIR_URL = 'https://mtr.sinir.gov.br/';

export function classeColor(id) {
    return CLASSES_RESIDUO.find((c) => c.id === id)?.color || '#8b9bb4';
}
export function ringelmann(grau) {
    return RINGELMANN.find((r) => r.grau === Number(grau)) || RINGELMANN[0];
}

// ─── Calendário Ambiental (Datas Comemorativas) ───

export const CALENDAR_CATEGORIES = {
    global: { label: 'Global / Internacional', color: '#00ccff' },
    nacional: { label: 'Nacional', color: '#10b981' },
    conscientizacao: { label: 'Conscientização', color: '#ffb700' },
    profissional: { label: 'Profissional', color: '#a78bfa' },
    institucional: { label: 'Institucional / Órgãos', color: '#ff9f43' },
    periodo: { label: 'Semana / Período', color: '#ff4757' },
    custom: { label: 'Customizado', color: '#06b6d4' },
};

export const DEFAULT_CALENDAR_EVENTS = [
    // Janeiro
    { dia: 11, mes: 1, titulo: 'Dia do Combate da Poluição por Agrotóxicos', categoria: 'nacional', obs: 'Conscientização sobre os impactos dos defensivos agrícolas.' },
    { dia: 31, mes: 1, titulo: 'Dia do Engenheiro Ambiental', categoria: 'profissional', obs: 'Homenagem aos profissionais de Engenharia Ambiental.' },
    
    // Fevereiro
    { dia: 2, mes: 2, titulo: 'Dia Mundial das Zonas Úmidas', categoria: 'global', obs: 'Preservação de áreas úmidas que abrigam biodiversidade.' },
    { dia: 6, mes: 2, titulo: 'Dia do Agente de Defesa Ambiental', categoria: 'profissional', obs: 'Valorização dos agentes que fiscalizam e protegem o meio ambiente.' },
    { dia: 22, mes: 2, titulo: 'Aniversário do IBAMA', categoria: 'institucional', obs: 'Fundação do Instituto Brasileiro do Meio Ambiente e dos Recursos Naturais Renováveis.' },
    
    // Março
    { dia: 1, mes: 3, titulo: 'Dia do Turismo Ecológico', categoria: 'nacional', obs: 'Fomento a viagens sustentáveis que conservam o meio natural.' },
    { dia: 2, mes: 3, titulo: 'Aniversário do Serviço Forestal Brasileiro – SFB', categoria: 'institucional', obs: 'Criação do órgão gestor das florestas públicas brasileiras.' },
    { dia: 16, mes: 3, titulo: 'Dia Nacional da Conscientização sobre as Mudanças Climáticas', categoria: 'conscientizacao', obs: 'Discussão sobre o aquecimento global e emissões de carbono.' },
    { dia: 21, mes: 3, titulo: 'Dia Mundial Florestal', categoria: 'global', obs: 'Importância das florestas para o equilíbrio ecológico e sustentabilidade.' },
    { dia: 22, mes: 3, titulo: 'Dia Mundial da Água', categoria: 'global', obs: 'Preservação e uso sustentável dos recursos hídricos mundiais.' },
    { dia: 24, mes: 3, titulo: 'Aniversário da Secretaria do Meio Ambiente', categoria: 'institucional', obs: 'Celebração institucional da criação da pasta ambiental.' },
    
    // Abril
    { dia: 15, mes: 4, titulo: 'Dia da Conservação do Solo', categoria: 'nacional', obs: 'Alerta sobre a degradação e erosão da camada fértil da terra.' },
    { dia: 17, mes: 4, titulo: 'Dia Nacional de Botânica', categoria: 'nacional', obs: 'Homenagem aos estudos científicos da flora nativa.' },
    { dia: 19, mes: 4, titulo: 'Dia dos Povos Indígenas', categoria: 'nacional', obs: 'Reconhecimento da cultura e do papel dos indígenas como guardiões da floresta.' },
    { dia: 22, mes: 4, titulo: 'Dia da Terra', categoria: 'global', obs: 'Movimento global pela conservação ambiental e conscientização ecológica.' },
    { dia: 28, mes: 4, titulo: 'Dia da Caatinga', categoria: 'nacional', obs: 'Preservação do bioma exclusivamente brasileiro do semiárido.' },
    
    // Maio
    { dia: 3, mes: 5, titulo: 'Dia do Solo e do Pau-Brasil', categoria: 'nacional', obs: 'Valorização da árvore símbolo do país e do solo fértil.' },
    { dia: 10, mes: 5, titulo: 'Dia do Campo', categoria: 'nacional', obs: 'Reconhecimento da vida rural e importância da agricultura sustentável.' },
    { dia: 22, mes: 5, titulo: 'Dia Internacional da Biodiversidade', categoria: 'global', obs: 'Promoção da conservação da rica variedade de vida do planeta.' },
    { dia: 25, mes: 5, titulo: 'Dia do Trabalhador Rural', categoria: 'nacional', obs: 'Homenagem aos trabalhadores do campo.' },
    { dia: 27, mes: 5, titulo: 'Dia da Mata Atlântica', categoria: 'nacional', obs: 'Alerta para a necessidade de recuperar o bioma mais devastado do Brasil.' },
    { dia: 31, mes: 5, diaFim: 5, mesFim: 6, titulo: 'Semana Nacional do Meio Ambiente', categoria: 'periodo', obs: 'Semana de debates e ações de preservação ecológica por todo o país.' },
    
    // Junho
    { dia: 5, mes: 6, titulo: 'Dia Mundial do Meio Ambiente', categoria: 'global', obs: 'Principal data da ONU para promover a conscientização ambiental global.' },
    { dia: 8, mes: 6, titulo: 'Dia Mundial dos Oceanos', categoria: 'global', obs: 'Proteção dos mares contra a poluição plástica e sobrepesca.' },
    { dia: 17, mes: 6, titulo: 'Dia do Gestor Ambiental', categoria: 'profissional', obs: 'Parabéns aos profissionais formados em Gestão Ambiental.' },
    { dia: 17, mes: 6, titulo: 'Dia Mundial de Combate à Desertificação e à Seca', categoria: 'global', obs: 'Combate à degradação de terras em áreas áridas e semiáridas.' },
    
    // Julho
    { dia: 10, mes: 7, titulo: 'Aniversário de criação do Fundo Nacional do Meio Ambiente', categoria: 'institucional', obs: 'Fundo que apoia projetos socioambientais de conservação.' },
    { dia: 12, mes: 7, titulo: 'Dia do Engenheiro Florestal', categoria: 'profissional', obs: 'Homenagem aos engenheiros que cuidam das nossas florestas.' },
    { dia: 17, mes: 7, titulo: 'Dia da Proteção das Florestas', categoria: 'nacional', obs: 'Luta contra o desmatamento ilegal e incêndios florestais.' },
    { dia: 26, mes: 7, titulo: 'Dia Mundial dos Manguezais', categoria: 'global', obs: 'Preservação desse ecossistema berçário da vida marinha.' },
    { dia: 28, mes: 7, titulo: 'Dia do Agricultor', categoria: 'nacional', obs: 'Homenagem a quem produz alimento com responsabilidade socioambiental.' },
    
    // Agosto
    { dia: 9, mes: 8, titulo: 'Dia Internacional dos Povos Indígenas', categoria: 'global', obs: 'Reconhecimento das populações nativas globais.' },
    { dia: 9, mes: 8, titulo: 'Dia Interamericano de Qualidade do Ar', categoria: 'global', obs: 'Combate às emissões atmosféricas nocivas.' },
    { dia: 14, mes: 8, titulo: 'Dia do Controle da Poluição Industrial', categoria: 'nacional', obs: 'Ações de mitigação de efluentes e emissões industriais.' },
    { dia: 28, mes: 8, titulo: 'Aniversário do Instituto Chico Mendes – ICMBio', categoria: 'institucional', obs: 'Criação da autarquia federal responsável pelas Unidades de Conservação.' },
    
    // Setembro
    { dia: 3, mes: 9, titulo: 'Dia Nacional do Biólogo', categoria: 'profissional', obs: 'Homenagem aos biólogos que estudam e defendem a fauna e a flora.' },
    { dia: 5, mes: 9, titulo: 'Dia da Amazônia', categoria: 'nacional', obs: 'Conscientização sobre a maior floresta tropical do mundo.' },
    { dia: 11, mes: 9, titulo: 'Dia Nacional do Cerrado', categoria: 'nacional', obs: 'Proteção da savana mais rica em biodiversidade do planeta.' },
    { dia: 16, mes: 9, titulo: 'Dia Internacional de Preservação da Camada de Ozônio', categoria: 'global', obs: 'Redução no uso de gases CFCs destruidores da camada protetora.' },
    { dia: 19, mes: 9, titulo: 'Dia Mundial pela Limpeza das Águas', categoria: 'global', obs: 'Mutirões globais de remoção de lixo de rios, praias e lagos.' },
    { dia: 21, mes: 9, titulo: 'Dia Internacional da Árvore', categoria: 'global', obs: 'Promoção do plantio de árvores e combate à desflorestação.' },
    { dia: 22, mes: 9, titulo: 'Dia da Defesa da Fauna', categoria: 'nacional', obs: 'Combate à caça ilegal, tráfico de animais silvestres e extinção.' },
    
    // Outubro
    { dia: 3, mes: 10, titulo: 'Dia Nacional das Abelhas', categoria: 'nacional', obs: 'Importância dos polinizadores para a reprodução vegetal e agricultura.' },
    { dia: 5, mes: 10, titulo: 'Dia das Aves', categoria: 'nacional', obs: 'Valorização da avifauna e habitats naturais de aves silvestres.' },
    { dia: 12, mes: 10, titulo: 'Dia Mundial para a Prevenção de Desastres Naturais e Dia do Mar', categoria: 'global', obs: 'Ações de resiliência climática e preservação dos oceanos.' },
    { dia: 12, mes: 10, titulo: 'Dia do Engenheiro Agrônomo', categoria: 'profissional', obs: 'Homenagem aos agrônomos que integram sustentabilidade e lavoura.' },
    { dia: 15, mes: 10, titulo: 'Dia do Educador Ambiental', categoria: 'profissional', obs: 'Reconhecimento dos educadores que disseminam a consciência ecológica.' },
    { dia: 27, mes: 10, titulo: 'Dia do Engenheiro Agrícola', categoria: 'profissional', obs: 'Homenagem a quem aplica tecnologia à agricultura de forma sustentável.' },
    
    // Novembro
    { dia: 19, mes: 11, titulo: 'Aniversário do Ministério do Meio Ambiente', categoria: 'institucional', obs: 'Fundação do Ministério do Meio Ambiente e Mudança do Clima.' },
    { dia: 30, mes: 11, titulo: 'Dia do Estatuto da Terra', categoria: 'nacional', obs: 'Marco legal que regula os direitos e obrigações do uso da terra no Brasil.' },
    
    // Dezembro
    { dia: 15, mes: 12, titulo: 'Dia do Jardineiro', categoria: 'profissional', obs: 'Quem cuida e cultiva nossas áreas verdes urbanas.' },
    { dia: 19, mes: 12, titulo: 'Aniversário da Agência Nacional de Águas - ANA', categoria: 'institucional', obs: 'Regulação do uso e qualidade da água no Brasil.' },
    { dia: 29, mes: 12, titulo: 'Dia Mundial da Biodiversidade', categoria: 'global', obs: 'Celebração global da variedade biológica e conservação genética.' },
];

export function isEventOnDate(event, dia, mes) {
    if (event.diaFim && event.mesFim) {
        const currentScore = mes * 100 + dia;
        const startScore = event.mes * 100 + event.dia;
        const endScore = event.mesFim * 100 + event.diaFim;
        if (startScore <= endScore) {
            return currentScore >= startScore && currentScore <= endScore;
        } else {
            return currentScore >= startScore || currentScore <= endScore;
        }
    }
    return event.dia === dia && event.mes === mes;
}

export function obterEventosProximos(eventos, dataReferencia = new Date(2026, 5, 9), diasAntecedencia = 15) {
    const ref = new Date(dataReferencia);
    ref.setHours(0, 0, 0, 0);
    const refYear = ref.getFullYear();
    const proximos = [];

    eventos.forEach(evt => {
        const datesToCheck = [
            new Date(refYear - 1, evt.mes - 1, evt.dia),
            new Date(refYear, evt.mes - 1, evt.dia),
            new Date(refYear + 1, evt.mes - 1, evt.dia)
        ];
        
        datesToCheck.forEach(d => {
            const diffTime = d.getTime() - ref.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= diasAntecedencia) {
                // Evita duplicar se por acaso passar da margem
                if (!proximos.some(p => p.titulo === evt.titulo && p.mes === evt.mes && p.dia === evt.dia)) {
                    proximos.push({
                        ...evt,
                        diasRestantes: diffDays,
                        dataCalculada: d
                    });
                }
            }
        });
    });

    return proximos.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

// ════════════════════════════════════════════════════════════════
//  ESG & Inventário de GEE (GHG Protocol / Programa Brasileiro GHG)
//  Base da tela de acompanhamento climático e ESG do SGA.
// ════════════════════════════════════════════════════════════════

// Escopos do GHG Protocol
export const GEE_ESCOPOS = {
    1: { id: 1, label: 'Escopo 1', titulo: 'Emissões Diretas', desc: 'Combustão em fontes próprias — geradores, frota e GLP', color: '#ff6b6b' },
    2: { id: 2, label: 'Escopo 2', titulo: 'Energia Adquirida', desc: 'Eletricidade comprada da rede (SIN)', color: '#feca57' },
    3: { id: 3, label: 'Escopo 3', titulo: 'Cadeia de Valor', desc: 'Emissões indiretas — logística, resíduos e viagens', color: '#54a0ff' },
};

// Fatores de emissão (kg CO₂e por unidade) — base Programa Brasileiro GHG Protocol / IPCC / MCTI
export const FATORES_EMISSAO = [
    { id: 'diesel_ger', nome: 'Óleo Diesel — Geradores', escopo: 1, categoria: 'Combustão estacionária', unidade: 'L', fator: 2.603 },
    { id: 'diesel_frota', nome: 'Óleo Diesel — Frota', escopo: 1, categoria: 'Combustão móvel', unidade: 'L', fator: 2.603 },
    { id: 'gasolina', nome: 'Gasolina — Frota', escopo: 1, categoria: 'Combustão móvel', unidade: 'L', fator: 2.212 },
    { id: 'glp', nome: 'GLP — Empilhadeiras / Cozinha', escopo: 1, categoria: 'Combustão estacionária', unidade: 'kg', fator: 2.930 },
    { id: 'gas_natural', nome: 'Gás Natural', escopo: 1, categoria: 'Combustão estacionária', unidade: 'm³', fator: 2.020 },
    { id: 'fugitivas_r410', nome: 'Recarga de Refrigerante (HFC)', escopo: 1, categoria: 'Emissões fugitivas', unidade: 'kg', fator: 2088 },
    { id: 'energia_sin', nome: 'Energia Elétrica — Rede (SIN)', escopo: 2, categoria: 'Eletricidade', unidade: 'kWh', fator: 0.0385 },
    { id: 'residuo_aterro', nome: 'Resíduos → Aterro', escopo: 3, categoria: 'Resíduos sólidos', unidade: 'kg', fator: 0.450 },
    { id: 'transporte_carga', nome: 'Transporte de Carga Terceirizado', escopo: 3, categoria: 'Logística', unidade: 'km', fator: 0.120 },
    { id: 'viagem_aerea', nome: 'Viagens Aéreas Corporativas', escopo: 3, categoria: 'Viagens a negócio', unidade: 'km', fator: 0.158 },
    { id: 'deslocamento', nome: 'Deslocamento de Colaboradores', escopo: 3, categoria: 'Deslocamento casa-trabalho', unidade: 'km', fator: 0.171 },
];

export function fatorEmissao(id) {
    return FATORES_EMISSAO.find((f) => f.id === id);
}

// Calcula CO₂e em toneladas a partir do consumo e do fator (kgCO₂e/unidade)
export function calcCO2e(consumo, fatorKg) {
    return (Number(consumo || 0) * Number(fatorKg || 0)) / 1000; // → toneladas
}

// Pilares ESG
export const ESG_PILARES = {
    E: { id: 'E', label: 'Ambiental', sigla: 'E', color: '#10b981', desc: 'Clima, energia, água e resíduos' },
    S: { id: 'S', label: 'Social', sigla: 'S', color: '#54a0ff', desc: 'Pessoas, segurança e comunidade' },
    G: { id: 'G', label: 'Governança', sigla: 'G', color: '#a78bfa', desc: 'Ética, compliance e transparência' },
};

// Programa de descarbonização (metas alinhadas a SBTi / Net Zero)
export const ESG_PROGRAMA_DEFAULT = {
    anoBase: 2024,
    anoMeta: 2030,
    reducaoMetaPct: 50,      // % de redução absoluta até o ano meta (alinhado SBTi 1,5 °C)
    metaNetZero: 2050,       // ano alvo de neutralidade
    producaoAnual: 8500,     // toneladas produzidas/ano — base de intensidade de carbono
    unidadeProducao: 't produzida',
};

export const STATUS_INICIATIVA = ['Planejada', 'Em andamento', 'Concluída', 'Suspensa'];
export const ESG_STATUS_COLORS = {
    'Planejada': '#8b9bb4', 'Em andamento': '#ffb700', 'Concluída': '#10b981', 'Suspensa': '#ff4757',
};

// Avalia um indicador ESG (progresso 0-100 conforme a direção desejada)
export function progressoIndicador(valor, meta, melhor = 'maior') {
    const v = Number(valor), m = Number(meta);
    if (!m && melhor === 'maior') return 0;
    let pct;
    if (melhor === 'maior') pct = (v / m) * 100;
    else pct = m ? ((2 * m - v) / m) * 100 : (v <= 0 ? 100 : 0); // menor é melhor
    return Math.max(0, Math.min(100, Math.round(pct)));
}

export function scoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#ffb700';
    if (score >= 20) return '#ff9f43';
    return '#ff4757';
}

export function scoreRating(score) {
    if (score >= 85) return 'AAA';
    if (score >= 75) return 'AA';
    if (score >= 65) return 'A';
    if (score >= 50) return 'BBB';
    if (score >= 35) return 'BB';
    if (score >= 20) return 'B';
    return 'CCC';
}

// ─── Coleta do inventário multiunidade (Mondial) ───
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Taxonomia oficial de fontes de emissão (Escopo → Categoria → tecnologias).
// Espelha o dicionário de dados do Programa de Carbono Mondial.
export const TAXONOMIA_EMISSOES = [
    { escopo: 1, categoria: 'Combustão estacionária', tecnologias: ['Geradores', 'Bombas de incêndio', 'Roçadeiras', 'Fogão (GLP)'], unidade: 'L' },
    { escopo: 1, categoria: 'Combustão móvel', tecnologias: ['Veículos leves', 'Caminhões pesados', 'Empilhadeiras'], unidade: 'L' },
    { escopo: 1, categoria: 'Emissões fugitivas', tecnologias: ['Extintores de CO₂', 'Ar-condicionado (HFC)'], unidade: 'kg' },
    { escopo: 1, categoria: 'Resíduos sólidos / Efluentes', tecnologias: ['Fossa séptica'], unidade: 'm³' },
    { escopo: 1, categoria: 'Atividades agrícolas', tecnologias: ['Fertilizantes sintéticos'], unidade: 'kg' },
    { escopo: 2, categoria: 'Aquisição de energia elétrica', tecnologias: ['Rede Interligada Nacional (SIN)'], unidade: 'kWh' },
    { escopo: 3, categoria: 'Transporte e distribuição (upstream)', tecnologias: ['Caminhão pesado', 'Motocicleta', 'Utilitários'], unidade: 't·km' },
    { escopo: 3, categoria: 'Resíduos gerados nas operações', tecnologias: ['Reciclagem', 'Compostagem', 'Aterro sanitário'], unidade: 'kg' },
    { escopo: 3, categoria: 'Viagens a negócios', tecnologias: ['Táxi', 'Avião comercial', 'Ônibus'], unidade: 'km' },
    { escopo: 3, categoria: 'Deslocamento de funcionários', tecnologias: ['Motocicleta', 'Metrô/Trem', 'Automóveis particulares'], unidade: 'km' },
];
// Rótulo canônico usado nos registros: "Escopo N: Categoria"
export const rotuloCategoria = (t) => `Escopo ${t.escopo}: ${t.categoria}`;
export const CATEGORIAS_EMISSAO = TAXONOMIA_EMISSOES.map(rotuloCategoria);
export function taxonomiaPorRotulo(rotulo) {
    return TAXONOMIA_EMISSOES.find((t) => rotuloCategoria(t) === rotulo);
}
export function unidadeMedidaPadrao(rotulo) {
    return taxonomiaPorRotulo(rotulo)?.unidade || '';
}

// Status da fonte (regra de fronteira de emissão)
export const STATUS_FONTE = {
    'Mapeado': { label: 'Mapeado', color: '#10b981', desc: 'Fonte dentro das fronteiras de emissão — exige coleta de dados.' },
    'Não aplicável': { label: 'Não aplicável', color: '#8b9bb4', desc: 'Equipamento inexistente na unidade ou gerido por terceiros (ex.: gerador do condomínio) — fora das fronteiras.' },
};

// Geolocalização / centro de custo: até 7 níveis organizacionais
export const HIERARQUIA_NIVEIS = 7;

// RBAC do Programa de Carbono (Role-Based Access Control)
export const PERFIS_CARBONO = {
    fornecedor: { label: 'Fornecedor de Informação', color: '#54a0ff', desc: 'Insere os dados dos IDs/parâmetros sob sua responsabilidade. Dono exclusivo do dado; visibilidade limitada aos seus parâmetros.' },
    gestor_unidade: { label: 'Gestor de Unidade Operacional', color: '#ffb700', desc: 'Leitura e gestão atreladas a um ou mais nós da hierarquia (suas unidades de atuação).' },
    gestor_corporativo: { label: 'Gestor Corporativo', color: '#a78bfa', desc: 'Visão holística e global. Administra o sistema, audita rastreabilidade e consolida as emissões da companhia.' },
};

export const COLETA_STATUS = {
    pendente: { label: 'Pendente', color: '#8b9bb4', sigla: '·' },
    coletado: { label: 'Coletado', color: '#10b981', sigla: '✓' },
    na: { label: 'Não aplicável', color: '#3a3d4a', sigla: '—' },
};
// Ciclo de status ao clicar numa célula de mês
export const proximoStatusColeta = (s) => (s === 'pendente' ? 'coletado' : s === 'coletado' ? 'na' : 'pendente');

// Deriva o escopo (1, 2 ou 3) a partir do rótulo da categoria ("Escopo 3: …")
export function escopoDaCategoria(categoria = '') {
    const m = String(categoria).match(/Escopo\s*(\d)/i);
    return m ? Number(m[1]) : 3;
}

// ════════════════════════════════════════════════════════════════
//  Glossário do SGA — termos técnicos em linguagem objetiva
//  (nível técnico/acadêmico, comunicação corporativa direta).
//  Usado pelos componentes didáticos (InfoTip, GlossarioModal).
// ════════════════════════════════════════════════════════════════
export const GLOSSARIO = [
    {
        termo: 'GEE — Gases de Efeito Estufa', tag: 'Carbono',
        def: 'Gases que retêm calor na atmosfera (CO₂, CH₄, N₂O, HFCs, PFCs, SF₆). A queima de combustíveis fósseis é a principal fonte na indústria.',
        ref: 'GHG Protocol / IPCC',
    },
    {
        termo: 'CO₂e — Dióxido de carbono equivalente', tag: 'Carbono',
        def: 'Unidade que padroniza todos os GEE na potência de aquecimento do CO₂, usando o GWP (Potencial de Aquecimento Global) de cada gás. Permite somar gases diferentes em um único número.',
        formula: 'CO₂e = massa do gás × GWP do gás',
    },
    {
        termo: 'Escopo 1 — Emissões diretas', tag: 'GHG Protocol',
        def: 'Emissões de fontes que a empresa possui ou controla: combustão em geradores e frota própria, GLP e fugas de gases de refrigeração.',
        ref: 'GHG Protocol',
    },
    {
        termo: 'Escopo 2 — Energia adquirida', tag: 'GHG Protocol',
        def: 'Emissões associadas à eletricidade comprada da rede. No Brasil usa-se o fator médio do SIN (Sistema Interligado Nacional), publicado pelo MCTI.',
        ref: 'GHG Protocol',
    },
    {
        termo: 'Escopo 3 — Cadeia de valor', tag: 'GHG Protocol',
        def: 'Emissões indiretas que a empresa não controla diretamente: transporte terceirizado, destinação de resíduos, viagens a negócio e deslocamento de colaboradores.',
        ref: 'GHG Protocol',
    },
    {
        termo: 'Fator de emissão', tag: 'Carbono',
        def: 'Quanto de CO₂e é gerado por unidade de atividade (ex.: kg CO₂e por litro de diesel). É a "taxa de conversão" entre o consumo e a emissão.',
        formula: 'Emissão (tCO₂e) = consumo × fator ÷ 1000',
    },
    {
        termo: 'Intensidade de carbono', tag: 'Indicador',
        def: 'Emissões por unidade de produção. Mostra a eficiência climática: a empresa pode crescer e, ainda assim, emitir menos por produto.',
        formula: 'Intensidade = emissões do ano ÷ produção do ano',
    },
    {
        termo: 'Linha de base (ano-base)', tag: 'Meta',
        def: 'Ano de referência do inventário contra o qual todas as reduções futuras são medidas. Define o ponto de partida da meta.',
    },
    {
        termo: 'SBTi — Science Based Targets', tag: 'Meta',
        def: 'Iniciativa que valida metas de redução de emissões alinhadas à ciência climática (limitar o aquecimento a 1,5 °C). Orienta o ritmo de descarbonização.',
        ref: 'sciencebasedtargets.org',
    },
    {
        termo: 'Net Zero (Neutralidade)', tag: 'Meta',
        def: 'Estado em que as emissões residuais são reduzidas ao máximo e o remanescente é compensado/removido, resultando em saldo líquido zero.',
    },
    {
        termo: 'I-REC', tag: 'Energia',
        def: 'Certificado internacional que comprova a origem renovável da energia consumida. Usado para reduzir as emissões de Escopo 2.',
    },
    {
        termo: 'Escala de Ringelmann', tag: 'Emissões atmosféricas',
        def: 'Método visual que compara a tonalidade da fumaça com padrões de cinza (graus 0 a 5, de 0% a 100% de enegrecimento). Quanto mais escura, maior a concentração de fuligem.',
        ref: 'ABNT NBR 6016 / Portaria IBAMA 85',
    },
    {
        termo: 'Limite legal (40% / grau 2)', tag: 'Emissões atmosféricas',
        def: 'Densidade máxima de fumaça preta tolerada para motores a diesel em regime. Acima disso há não conformidade ambiental (exceto picos curtos na partida).',
        ref: 'Portaria IBAMA 85/1996',
    },
    {
        termo: 'ESG', tag: 'Gestão',
        def: 'Ambiental, Social e Governança — três dimensões que medem a sustentabilidade e a responsabilidade corporativa além do resultado financeiro.',
    },
    {
        termo: 'MTR / SINIR', tag: 'Resíduos',
        def: 'Manifesto de Transporte de Resíduos: documento que rastreia o resíduo da geração até a destinação final, declarado no Sistema Nacional de Informações sobre a Gestão dos Resíduos Sólidos.',
        ref: 'PNRS / Lei 12.305',
    },
    {
        termo: 'Classes de resíduo (NBR 10004)', tag: 'Resíduos',
        def: 'Classe I (perigoso), II A (não inerte) e II B (inerte). Define exigências de manuseio, transporte e destinação.',
        ref: 'ABNT NBR 10004',
    },
    {
        termo: 'Valorização de resíduos', tag: 'Resíduos',
        def: 'Percentual de resíduos desviados do aterro via reciclagem, reutilização, compostagem ou coprocessamento. Indicador-chave de economia circular.',
        formula: 'Valorização = resíduo não-aterrado ÷ resíduo total',
    },
    {
        termo: 'Coprocessamento', tag: 'Resíduos',
        def: 'Uso de resíduos como substituto de combustível/matéria-prima em fornos de cimento, recuperando energia e eliminando o passivo sem aterro.',
    },
];

