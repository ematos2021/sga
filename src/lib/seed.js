// ════════════════════════════════════════════════════════════════
//  Seed — popula dados de exemplo na primeira execução.
//  Permite demonstrar todas as telas sem backend.
// ════════════════════════════════════════════════════════════════
import { getCollection, saveCollection, uid, COL } from './store';
import { DEFAULT_CALENDAR_EVENTS, fatorEmissao, ESG_PROGRAMA_DEFAULT, MESES, unidadeMedidaPadrao, escopoDaCategoria } from './constants';
import { CONTATOS_MONDIAL, MAPA_EMISSOES_MONDIAL } from './mondialSeed';

// ─── Helpers do mapa de coleta (governança do dicionário de dados) ───
const mesesPendentes = () => MESES.reduce((acc, m) => ({ ...acc, [m]: 'pendente' }), {});

// Tenta achar o e-mail do fornecedor pelo primeiro nome (preferindo a unidade)
function emailFornecedor(nome, unidade) {
    if (!nome) return '';
    const first = nome.split(/[/,]/)[0].trim().split(' ')[0].toLowerCase();
    if (!first) return '';
    const naUnidade = CONTATOS_MONDIAL.find((c) =>
        (c.gestor || '').toLowerCase().includes(first) &&
        (unidade || '').toLowerCase().includes((c.unidade || '').split(' ')[0].toLowerCase()));
    const qualquer = CONTATOS_MONDIAL.find((c) => (c.gestor || '').toLowerCase().includes(first));
    return (naUnidade || qualquer)?.email || '';
}

// Enriquece uma linha bruta do mapa com o schema completo de governança
function enriquecerFonte(raw, i) {
    const rotulo = raw.categoria;
    return {
        paramId: 'MND-' + String(i + 1).padStart(4, '0'),
        unidade: raw.unidade,
        hierarquia: [raw.unidade, '', '', '', '', '', ''], // Hierarquia 1..7
        escopo: escopoDaCategoria(rotulo),
        categoria: rotulo,
        tecnologia: '',
        parametro: raw.tema,
        tema: raw.tema,
        unidadeMedida: unidadeMedidaPadrao(rotulo),
        status: 'Mapeado',
        fornecedor: { nome: raw.responsavel || '', email: emailFornecedor(raw.responsavel, raw.unidade) },
        validador: { nome: '', email: '' },
        meses: mesesPendentes(),
    };
}


const today = new Date();
function daysAgo(n) {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

const RESIDUOS = [
    { nome: 'Sucata Plástica (PEAD/PP)', classe: 'IIB', codigoIbama: '070213', estado: 'Sólido', unidade: 'kg', destinacao: 'Reciclagem', destinador: 'VIAMED Reciclagem' },
    { nome: 'Borra Oleosa', classe: 'I', codigoIbama: '120109', estado: 'Pastoso', unidade: 'tambor', destinacao: 'Coprocessamento', destinador: 'EcoTratar Ambiental' },
    { nome: 'Papelão / Aparas', classe: 'IIB', codigoIbama: '150101', estado: 'Sólido', unidade: 'kg', destinacao: 'Reciclagem', destinador: 'RecicraPapel' },
    { nome: 'Lâmpadas Fluorescentes', classe: 'I', codigoIbama: '200121', estado: 'Sólido', unidade: 'unidade', destinacao: 'Tratamento', destinador: 'Apliquim Brasil' },
    { nome: 'Resíduo Orgânico (Refeitório)', classe: 'IIA', codigoIbama: '200108', estado: 'Sólido', unidade: 'kg', destinacao: 'Compostagem', destinador: 'Fazenda Verde' },
    { nome: 'Sucata Metálica', classe: 'IIB', codigoIbama: '120102', estado: 'Sólido', unidade: 'kg', destinacao: 'Reciclagem', destinador: 'Metalúrgica Ferro Forte' },
];

const MOTORISTAS = [
    { nome: 'Carlos Andrade', empresa: 'VIAMED Reciclagem', telefone: '(11) 99812-3344', placa: 'FGH-2D34', whatsapp: true, obs: 'Coleta de sucata plástica — terças e quintas' },
    { nome: 'José Pereira', empresa: 'EcoTratar Ambiental', telefone: '(11) 99745-1190', placa: 'KLM-8821', whatsapp: true, obs: 'Resíduos Classe I — requer agendamento 24h' },
    { nome: 'Marcos Lima', empresa: 'RecicraPapel', telefone: '(11) 99655-7788', placa: 'BRA-1A99', whatsapp: false, obs: 'Coleta de papelão — segundas' },
    { nome: 'Antônio Souza', empresa: 'Metalúrgica Ferro Forte', telefone: '(11) 99511-2020', placa: 'XYZ-4477', whatsapp: true, obs: 'Sucata metálica — sob demanda' },
];

const GERADORES = [
    { tag: 'Gerador 1', descricao: 'Motor Scania / óleo diesel', injecao: 'Semielétrica', fabricante: 'Scania', potencia: '550 hp' },
    { tag: 'Gerador 2', descricao: 'Motor Scania / óleo diesel', injecao: 'Semielétrica', fabricante: 'Scania', potencia: '550 hp' },
    { tag: 'Gerador 3', descricao: 'Motor Scania / óleo diesel', injecao: 'Eletrônica', fabricante: 'Scania', potencia: '550 hp' },
    { tag: 'Gerador 4', descricao: 'Motor Scania / óleo diesel', injecao: 'Eletrônica', fabricante: 'Scania', potencia: '550 hp' },
    { tag: 'Gerador 5', descricao: 'Motor Scania / óleo diesel', injecao: 'Eletrônica', fabricante: 'Scania', potencia: '550 hp' },
    { tag: 'Gerador 6', descricao: 'Motor Scania / óleo diesel', injecao: 'Eletrônica', fabricante: 'Scania', potencia: '550 hp' },
    { tag: 'Gerador 7', descricao: 'Motor Scania / óleo diesel', injecao: 'Eletrônica', fabricante: 'Scania', potencia: '550 hp' },
];

const MANIFESTOS = [
    { numeroMTR: '2406000123456', data: daysAgo(2), residuo: 'Borra Oleosa', quantidade: 3, unidade: 'tambor', transportador: 'EcoTratar Ambiental', destinador: 'EcoTratar Ambiental', destinacao: 'Coprocessamento', status: 'Recebido', sinir: true },
    { numeroMTR: '2406000123789', data: daysAgo(1), residuo: 'Sucata Plástica (PEAD/PP)', quantidade: 820, unidade: 'kg', transportador: 'VIAMED Reciclagem', destinador: 'VIAMED Reciclagem', destinacao: 'Reciclagem', status: 'Em Transporte', sinir: true },
    { numeroMTR: '2406000124002', data: daysAgo(0), residuo: 'Lâmpadas Fluorescentes', quantidade: 140, unidade: 'unidade', transportador: 'EcoTratar Ambiental', destinador: 'Apliquim Brasil', destinacao: 'Tratamento', status: 'Emitido', sinir: true },
];

const AUTORIZACOES = [
    { data: daysAgo(2), residuo: 'Borra Oleosa', quantidade: 3, unidade: 'tambor', transportadora: 'EcoTratar Ambiental', motorista: 'José Pereira', placa: 'KLM-8821', destino: 'EcoTratar Ambiental', responsavel: 'Eugênio Matos', status: 'Liberada' },
    { data: daysAgo(1), residuo: 'Sucata Plástica (PEAD/PP)', quantidade: 820, unidade: 'kg', transportadora: 'VIAMED Reciclagem', motorista: 'Carlos Andrade', placa: 'FGH-2D34', destino: 'VIAMED Reciclagem', responsavel: 'Eugênio Matos', status: 'Liberada' },
    { data: daysAgo(0), residuo: 'Papelão / Aparas', quantidade: 310, unidade: 'kg', transportadora: 'RecicraPapel', motorista: 'Marcos Lima', placa: 'BRA-1A99', destino: 'RecicraPapel', responsavel: 'Eugênio Matos', status: 'Pendente' },
];

// Geradores e seus tipos de injeção (espelha o cadastro)
const GER_INJ = {
    'Gerador 1': 'Semielétrica', 'Gerador 2': 'Semielétrica', 'Gerador 3': 'Eletrônica',
    'Gerador 4': 'Eletrônica', 'Gerador 5': 'Eletrônica', 'Gerador 6': 'Eletrônica', 'Gerador 7': 'Eletrônica',
};
// Monta uma rodada: valores na ordem G1..G7
const round = (hora, fase, valores) => ({
    id: uid(), hora, fase,
    medicoes: Object.keys(GER_INJ).map((g, i) => ({ gerador: g, injecao: GER_INJ[g], apurado: valores[i] })),
});

// Relatório de abril (FR 658) — dados idênticos ao documento oficial
const RELATORIO_ABRIL = {
    numeroFR: 'FR 658', revisao: '00', revData: 'Fevereiro 2023', empresa: 'Grupo MK',
    data: '2026-04-08', hora: '15:50',
    elaboradores: ['Gabriela Alves dos Santos', 'Henrique Santos'],
    referenciaNormativa: 'NBR ISO 14001:2015\nPortaria Federal IBAMA nº 85 de 17/10/1996\nABNT NBR 6016:1986',
    metodo: 'Ensaio com Escala Ringelmann Reduzida',
    fonte: 'Geradores (motor Scania/óleo diesel, 550 hp)',
    descricaoMetodo:
        'Os geradores foram ligados um a um para a medição da emissão de fumaça preta no momento da ignição.\n\n' +
        'Após a verificação do grau de enegrecimento da fumaça emitida pelos geradores utilizando a Escala Ringelmann (datada de 2023) no momento da ignição, os geradores foram ligados simultaneamente para verificação da emissão da fumaça no funcionamento dos geradores com carga.\n\n' +
        'A Escala de Ringelmann foi segurada com o braço esticado a uma distância média de 30 m do escapamento dos geradores. Avaliou-se o grau de enegrecimento dos gases do escapamento, através do orifício da Escala, contra um fundo claro e verificado qual dos padrões da Escala mais se assemelhou à tonalidade dos gases emitidos. Os resultados das medições estão registrados neste Relatório bem como as fotos que demonstram a fumaça emitida pelos geradores.',
    rounds: [
        round('15:50', 'Ignição', [0, 60, 0, 40, 0, 20, 40]),
        round('15:55', 'Carga', [0, 60, 0, 20, 0, 20, 20]),
        round('15:57', 'Carga', [0, 20, 0, 20, 0, 20, 20]),
        round('16:05', 'Carga', [0, 20, 0, 20, 0, 20, 20]),
    ],
    parecer:
        'Foi verificado que apenas no momento da ignição o gerador 02 apresentou nível de fumaça acima de 20%, apresentando um índice de 60% segundo Escala Ringelmann. ' +
        'Foi informado também que os geradores 01, 03 e 05 estão com problemas, diante disso, os geradores não estão operando; aguardando a peça chegar para realizar os reparos.',
    elaborador: 'Gabriela Alves dos Santos',
    cargoElaborador: 'Analista Ambiental – Sistema de Gestão Integrado',
    status: 'Concluído',
};

const FUMACA = [RELATORIO_ABRIL];

const NFSUCATA = [
    { numeroNF: '001245', data: daysAgo(10), peso: 760, valorKg: 1.85, fornecedor: 'VIAMED', status: 'Paga' },
    { numeroNF: '001260', data: daysAgo(3), peso: 820, valorKg: 1.90, fornecedor: 'VIAMED', status: 'Faturada' },
];

// ─── Inventário de GEE (GHG Protocol) ───
// [ano, fatorId, consumo, atividade]. O fator/escopo/unidade vêm do catálogo.
const EMISSOES_RAW = [
    // 2024 — ano base do inventário
    [2024, 'diesel_ger', 52000, 'Geradores Scania (7 un.) — backup e ponta'],
    [2024, 'diesel_frota', 28000, 'Frota própria de movimentação'],
    [2024, 'glp', 1100, 'Empilhadeiras e refeitório'],
    [2024, 'fugitivas_r410', 6, 'Recarga de sistemas de climatização'],
    [2024, 'energia_sin', 1320000, 'Consumo de energia da rede'],
    [2024, 'residuo_aterro', 58000, 'Rejeitos enviados a aterro'],
    [2024, 'transporte_carga', 110000, 'Coletas e transporte terceirizado'],
    [2024, 'viagem_aerea', 42000, 'Viagens corporativas'],
    // 2025
    [2025, 'diesel_ger', 44000, 'Geradores Scania (7 un.)'],
    [2025, 'diesel_frota', 25000, 'Frota própria de movimentação'],
    [2025, 'glp', 1000, 'Empilhadeiras e refeitório'],
    [2025, 'fugitivas_r410', 4, 'Recarga de sistemas de climatização'],
    [2025, 'energia_sin', 1180000, 'Consumo de energia da rede'],
    [2025, 'residuo_aterro', 40000, 'Rejeitos enviados a aterro'],
    [2025, 'transporte_carga', 98000, 'Coletas e transporte terceirizado'],
    [2025, 'viagem_aerea', 36000, 'Viagens corporativas'],
    // 2026 — ano corrente (parcial)
    [2026, 'diesel_ger', 18000, 'Geradores Scania (7 un.)'],
    [2026, 'diesel_frota', 11000, 'Frota própria de movimentação'],
    [2026, 'energia_sin', 520000, 'Consumo de energia da rede'],
    [2026, 'residuo_aterro', 15000, 'Rejeitos enviados a aterro'],
    [2026, 'transporte_carga', 42000, 'Coletas e transporte terceirizado'],
];
const EMISSOES = EMISSOES_RAW.map(([ano, fatorId, consumo, atividade]) => {
    const f = fatorEmissao(fatorId);
    return {
        data: `${ano}-06-30`, ano, escopo: f.escopo, categoria: f.categoria,
        fonte: f.nome, atividade, fatorId, consumo, unidade: f.unidade, fator: f.fator,
    };
});

// ─── Indicadores ESG (registrados manualmente; os ambientais derivados
//     são calculados na tela a partir das demais coleções) ───
const ESG_IND = [
    // Ambiental (E)
    { pilar: 'E', nome: 'Energia renovável na matriz', valor: 22, meta: 50, unidade: '%', melhor: 'maior' },
    { pilar: 'E', nome: 'Intensidade hídrica', valor: 1.8, meta: 1.4, unidade: 'm³/t', melhor: 'menor' },
    // Social (S)
    { pilar: 'S', nome: 'Treinamento de SMS por colaborador', valor: 18, meta: 20, unidade: 'h', melhor: 'maior' },
    { pilar: 'S', nome: 'Taxa de frequência de acidentes (TF)', valor: 2.1, meta: 1.0, unidade: 'TF', melhor: 'menor' },
    { pilar: 'S', nome: 'Mulheres em cargos de liderança', valor: 32, meta: 40, unidade: '%', melhor: 'maior' },
    { pilar: 'S', nome: 'Satisfação dos colaboradores', valor: 78, meta: 85, unidade: '%', melhor: 'maior' },
    // Governança (G)
    { pilar: 'G', nome: 'Conformidade legal ambiental', valor: 96, meta: 100, unidade: '%', melhor: 'maior' },
    { pilar: 'G', nome: 'Não conformidades em aberto', valor: 3, meta: 0, unidade: 'un', melhor: 'menor' },
    { pilar: 'G', nome: 'Fornecedores avaliados em ESG', valor: 64, meta: 90, unidade: '%', melhor: 'maior' },
    { pilar: 'G', nome: 'Treinamento em ética e compliance', valor: 88, meta: 100, unidade: '%', melhor: 'maior' },
];

// ─── Iniciativas de descarbonização ───
const INICIATIVAS = [
    { nome: 'Usina solar fotovoltaica própria (500 kWp)', escopo: 2, status: 'Em andamento', reducao: 42, prazo: '2026-12', responsavel: 'Engenharia de Energia' },
    { nome: 'Substituição de 2 geradores diesel por gás natural', escopo: 1, status: 'Planejada', reducao: 38, prazo: '2027-06', responsavel: 'Manutenção Industrial' },
    { nome: 'Compra de I-RECs (energia renovável certificada)', escopo: 2, status: 'Planejada', reducao: 30, prazo: '2028-01', responsavel: 'Suprimentos' },
    { nome: 'Programa Aterro Zero — coprocessamento de rejeitos', escopo: 3, status: 'Concluída', reducao: 18, prazo: '2025-12', responsavel: 'SGI Ambiental' },
    { nome: 'Otimização de rotas logísticas com telemetria', escopo: 3, status: 'Em andamento', reducao: 9, prazo: '2026-09', responsavel: 'Logística' },
    { nome: 'Retrofit de iluminação LED + sensores de presença', escopo: 2, status: 'Concluída', reducao: 6, prazo: '2025-06', responsavel: 'Facilities' },
];

// Migração: substitui dados de fumaça/geradores no formato antigo (grau único)
// pelo novo modelo de relatório FR 658.
function migrateFumaca() {
    // v2: converte o modelo antigo (grau único) para o relatório FR 658 (rounds).
    if (!localStorage.getItem('sga_fumaca_v2')) {
        const fum = getCollection(COL.FUMACA);
        const formatoAntigo = fum.length > 0 && fum.some((f) => f.grau !== undefined && !f.rounds);
        if (formatoAntigo || fum.length === 0) {
            saveCollection(COL.GERADORES, GERADORES.map((r) => ({ id: uid(), createdAt: new Date().toISOString(), ...r })));
            saveCollection(COL.FUMACA, FUMACA.map((r) => ({ id: uid(), createdAt: new Date().toISOString(), ...r })));
        }
        localStorage.setItem('sga_fumaca_v2', '1');
    }

    // v3: corrige o texto do método para ficar fiel ao documento FR 658
    // (acrescenta "(datada de 2023)" e a frase final sobre o registro dos
    // resultados), sem apagar relatórios criados pelo usuário.
    if (!localStorage.getItem('sga_fumaca_v3')) {
        const trechoAntigo = 'utilizando a Escala Ringelmann no momento da ignição';
        const fum = getCollection(COL.FUMACA);
        let alterou = false;
        const corrigido = fum.map((f) => {
            if (typeof f.descricaoMetodo === 'string' && f.descricaoMetodo.includes(trechoAntigo)) {
                alterou = true;
                return { ...f, descricaoMetodo: RELATORIO_ABRIL.descricaoMetodo };
            }
            return f;
        });
        if (alterou) saveCollection(COL.FUMACA, corrigido);
        localStorage.setItem('sga_fumaca_v3', '1');
    }
}

// Migração do mapa de coleta para o schema de governança (paramId, status,
// unidade de medida, fornecedor/validador, hierarquia), preservando o que o
// usuário já registrou (meses, status e responsáveis), por unidade+tema.
function migrateMapa() {
    if (localStorage.getItem('sga_mapa_v2')) return;
    const atual = getCollection(COL.MAPA_EMISSOES);
    if (atual.length && atual.some((m) => !m.paramId)) {
        const byKey = {};
        atual.forEach((m) => { byKey[`${m.unidade}|${m.tema || m.parametro || ''}`] = m; });
        const novo = MAPA_EMISSOES_MONDIAL.map((raw, i) => {
            const e = enriquecerFonte(raw, i);
            const old = byKey[`${raw.unidade}|${raw.tema}`];
            if (old) {
                if (old.meses) e.meses = old.meses;
                if (old.status) e.status = old.status;
                if (old.fornecedor) e.fornecedor = old.fornecedor;
                if (old.validador) e.validador = old.validador;
            }
            return { id: old?.id || uid(), createdAt: old?.createdAt || new Date().toISOString(), ...e };
        });
        saveCollection(COL.MAPA_EMISSOES, novo);
    }
    localStorage.setItem('sga_mapa_v2', '1');
}

export function seedIfEmpty() {
    migrateFumaca();
    migrateMapa();

    // Se a coleção de calendário estiver vazia, popula ela (para retrocompatibilidade)
    if (getCollection(COL.CALENDARIO).length === 0) {
        saveCollection(COL.CALENDARIO, DEFAULT_CALENDAR_EVENTS.map((r) => ({ id: uid(), createdAt: new Date().toISOString(), ...r })));
    }

    // Coleções ESG & Carbono — populadas mesmo para usuários antigos (fora do guard)
    const ensureNew = (col, rows) => {
        if (getCollection(col).length === 0) {
            saveCollection(col, rows.map((r) => ({ id: uid(), createdAt: new Date().toISOString(), ...r })));
        }
    };
    ensureNew(COL.EMISSOES, EMISSOES);
    ensureNew(COL.ESG_IND, ESG_IND);
    ensureNew(COL.INICIATIVAS, INICIATIVAS);
    ensureNew(COL.CONTATOS, CONTATOS_MONDIAL);
    // Mapa de coleta: schema completo de governança (fonte × parâmetro × responsável)
    ensureNew(COL.MAPA_EMISSOES, MAPA_EMISSOES_MONDIAL.map((r, i) => enriquecerFonte(r, i)));
    if (getCollection(COL.ESG_CFG).length === 0) {
        saveCollection(COL.ESG_CFG, [{ id: 'cfg', ...ESG_PROGRAMA_DEFAULT }]);
    }

    if (localStorage.getItem('sga_seeded')) return;

    const ensure = (col, rows) => {
        if (getCollection(col).length === 0) {
            saveCollection(col, rows.map((r) => ({ id: uid(), createdAt: new Date().toISOString(), ...r })));
        }
    };

    ensure(COL.RESIDUOS, RESIDUOS);
    ensure(COL.MOTORISTAS, MOTORISTAS);
    ensure(COL.GERADORES, GERADORES);
    ensure(COL.MANIFESTOS, MANIFESTOS);
    ensure(COL.AUTORIZACOES, AUTORIZACOES);
    ensure(COL.FUMACA, FUMACA);
    ensure(COL.NFSUCATA, NFSUCATA);
    ensure(COL.CALENDARIO, DEFAULT_CALENDAR_EVENTS);

    // Tickets derivados dos manifestos coletados/recebidos
    const manifestos = getCollection(COL.MANIFESTOS);
    const tickets = manifestos
        .filter((m) => m.status !== 'Emitido' && m.status !== 'Cancelado')
        .map((m, i) => ({
            id: uid(),
            createdAt: new Date().toISOString(),
            numero: 'TK-' + String(1001 + i),
            manifestoId: m.id,
            numeroMTR: m.numeroMTR,
            residuo: m.residuo,
            dataColeta: m.data,
            motorista: m.transportador,
            pesoAferido: m.quantidade,
            unidade: m.unidade,
            status: m.status === 'Recebido' ? 'Conferido' : 'Coletado',
            obs: '',
        }));
    if (getCollection(COL.TICKETS).length === 0) saveCollection(COL.TICKETS, tickets);

    localStorage.setItem('sga_seeded', '1');
}
