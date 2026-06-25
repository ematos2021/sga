// ════════════════════════════════════════════════════════════════
//  Mondial Supply & Sustainability — Master Data (v1.0.0)
//  Fonte: MONDIAL_MASTER_DATA_GRAVITY.json (acentuação normalizada).
//  Alimenta o módulo ESG & Carbono: responsáveis por fonte/escopo e
//  o mapa de coleta mensal do inventário de GEE (multiunidade).
// ════════════════════════════════════════════════════════════════

// ─── Diretório de responsáveis por unidade/setor ───
export const CONTATOS_MONDIAL = [
    { unidade: 'Bahia', setor: 'Manutenção', gestor: 'Marcio', ramal: '4409', telefone: '(75) 99850-1405', email: 'marcio.russi@emondial.com' },
    { unidade: 'Bahia', setor: 'Almoxarifado', gestor: 'Zósimo', ramal: '4515', telefone: '(75) 99812-2668', email: 'zosimo.novais@emondial.com' },
    { unidade: 'Bahia', setor: 'Centro de Distribuição', gestor: 'Danilo', ramal: '4520', telefone: '(75) 99893-2961', email: 'danilo.virgens@emondial.com' },
    { unidade: 'Bahia', setor: 'Centro de Distribuição', gestor: 'Taimonn', ramal: '4445', telefone: '(75) 99225-4282', email: 'taimonn.ramos@emondial.com' },
    { unidade: 'Bahia', setor: 'Centro de Distribuição', gestor: 'Huggo', ramal: '4527', telefone: '(75) 99928-8369', email: 'huggo.goncalves@emondial.com' },
    { unidade: 'Bahia', setor: 'Suprimentos', gestor: 'Eduardo', ramal: '4459', telefone: '(75) 99968-0804', email: 'eduardo.braga@emondial.com' },
    { unidade: 'Bahia', setor: 'Suprimentos', gestor: 'Lorena', ramal: '4433', telefone: '(75) 99812-9755', email: 'lorena.vitoria@emondial.com' },
    { unidade: 'Bahia', setor: 'Gestão de peças / Assistência Técnica', gestor: 'José Maria', ramal: '4517', telefone: '', email: 'jose.tanajura@emondial.com' },
    { unidade: 'Bahia', setor: 'Recursos Humanos', gestor: 'Silvio', ramal: '4466', telefone: '(75) 99931-9909', email: 'silvio.carlos@emondial.com' },
    { unidade: 'MK NE', setor: 'Recebimento, Armazenamento e Expedição', gestor: 'Gilcimara', ramal: '4443', telefone: '(75) 99911-1233', email: 'gilcimara.jesus@emondial.com' },
    { unidade: 'Manaus', setor: 'Manutenção e Ferramentaria', gestor: 'Antonio Gonçalves', ramal: '1662', telefone: '(92) 98110-1338', email: 'antonio.goncalves@emondial.com' },
    { unidade: 'Manaus', setor: 'Almoxarifado', gestor: 'Josemar Araujo Loureiro', ramal: '1662', telefone: '(92) 98110-1338', email: '' },
    { unidade: 'Manaus', setor: 'PCPM e Compras', gestor: 'Daniel Mori', ramal: '1691', telefone: '(92) 98110-1837', email: 'daniel.mori@emondial.com' },
    { unidade: 'Manaus', setor: 'Expedição', gestor: 'Magno Mendes', ramal: '1621', telefone: '(92) 99478-5462', email: 'magno.guedes@emondial.com' },
    { unidade: 'Manaus', setor: 'Carros dos colaboradores', gestor: 'Denis', ramal: '', telefone: '(92) 98290-6463', email: 'denis.ozorio@emondial.com' },
    { unidade: 'Manaus', setor: 'Recursos Humanos', gestor: 'Janecleide', ramal: '4232', telefone: '', email: 'janecleide.silva@emondial.com' },
    { unidade: 'Manaus', setor: 'Recursos Humanos', gestor: 'Bruna Michela', ramal: '1608', telefone: '(92) 98428-9244', email: 'bruna.melo@emondial.com' },
    { unidade: 'Manaus', setor: 'Resíduos', gestor: 'Paulo Maciel', ramal: '', telefone: '', email: 'paulo.maciel@emondial.com' },
    { unidade: 'Manaus', setor: 'Viagem Internacional', gestor: 'Bianca Mara', ramal: '1671', telefone: '', email: 'bianca.sousa@emondial.com' },
    { unidade: 'SP Barueri', setor: 'Logística', gestor: 'Ulisses', ramal: '', telefone: '', email: 'ulisses.behr@emondial.com' },
    { unidade: 'SP Barueri', setor: 'Recursos Humanos', gestor: 'Janecleide', ramal: '4232', telefone: '', email: 'janecleide.silva@emondial.com' },
    { unidade: 'SP Barueri', setor: 'Importação', gestor: 'Amanda Barbosa', ramal: '4220', telefone: '', email: 'amanda.barbosa1@emondial.com' },
    { unidade: 'SP Barueri', setor: 'Pós-Venda', gestor: 'Rogério Vasconcelos', ramal: '3848', telefone: '', email: 'rogerio.vasconcelos@emondial.com' },
    { unidade: 'SP Barueri', setor: 'Viagens', gestor: 'Roberto Viana', ramal: '2986', telefone: '', email: 'roberto.viana@emondial.com' },
    { unidade: 'SP Barueri', setor: 'Consumo de Eletricidade', gestor: 'Gabriela (contas a pagar)', ramal: '3037', telefone: '', email: 'gabriela.marcal@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Centro de Distribuição', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Carro Terceirizado', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Carro Terceirizado', gestor: 'RH', ramal: '', telefone: '', email: '' },
    { unidade: 'Araçariguama', setor: 'Terceirizado de consumo de gases', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Terceirizado de consumo de gases', gestor: 'Suellen', ramal: '4303', telefone: '', email: 'suelen.sampaio@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Consumo de Eletricidade', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Consumo de Eletricidade', gestor: 'Suellen', ramal: '4303', telefone: '', email: 'suelen.sampaio@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Frotas (contratada por São Paulo)', gestor: 'Ulisses Behr', ramal: '', telefone: '', email: 'ulisses.behr@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Frotas (contratada por São Paulo)', gestor: 'Rafael', ramal: '', telefone: '', email: '' },
    { unidade: 'Araçariguama', setor: 'DLD Resíduo', gestor: 'Suellen', ramal: '4303', telefone: '', email: 'suelen.sampaio@emondial.com' },
    { unidade: 'Araçariguama', setor: 'Carros Fretados', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'MK Sul', setor: 'Centro de Distribuição', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'MK Sul', setor: 'Carro Terceirizado', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'MK Sul', setor: 'Terceirizado de consumo de gases', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'MK Sul', setor: 'Terceirizado de consumo de gases', gestor: 'Adriano Machado', ramal: '6344', telefone: '', email: 'adriano.machado@mksul.com' },
    { unidade: 'MK Sul', setor: 'Consumo de Eletricidade', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'MK Sul', setor: 'Consumo de Eletricidade', gestor: 'Adriano Machado', ramal: '6344', telefone: '', email: 'adriano.machado@mksul.com' },
    { unidade: 'MK Sul', setor: 'Frotas (Contrato Avulso)', gestor: 'Adriano Machado', ramal: '6344', telefone: '', email: 'adriano.machado@mksul.com' },
    { unidade: 'MK Sul', setor: 'Resíduo', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'MK Sul', setor: 'Carros Fretados', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'Cajamar', setor: 'Terceirizado de consumo de gases', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'Cajamar', setor: 'Terceirizado de consumo de gases', gestor: 'Marcio Valeriano', ramal: '3045', telefone: '', email: 'marcio.valeriano@emondial.com' },
    { unidade: 'Cajamar', setor: 'Consumo de Eletricidade', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
    { unidade: 'Cajamar', setor: 'Consumo de Eletricidade', gestor: 'Marcio Valeriano', ramal: '3045', telefone: '', email: 'marcio.valeriano@emondial.com' },
    { unidade: 'Cajamar', setor: 'Frotas (contratada por São Paulo)', gestor: 'Ulisses Behr', ramal: '', telefone: '', email: '' },
    { unidade: 'Cajamar', setor: 'Frotas (contratada por São Paulo)', gestor: 'Rafael', ramal: '', telefone: '', email: '' },
    { unidade: 'Cajamar', setor: 'Carros Fretados', gestor: 'Roberval', ramal: '4308', telefone: '(47) 99737-0554', email: 'roberval.brito@emondial.com' },
];

// ─── Mapa de coleta do inventário (fonte de emissão × responsável × escopo) ───
// Os 12 meses ainda não foram coletados (status inicial: 'pendente').
export const MAPA_EMISSOES_MONDIAL = [
    { unidade: 'Manaus', tema: 'ETE Manaus (efluentes/ambiental)', responsavel: 'Paulo', categoria: 'Escopo 1: Resíduos sólidos / Efluentes' },
    { unidade: 'Manaus, Cajamar, Araçariguama e MK Sul', tema: 'Modal, tipo de veículo, combustível, tonelada, distância percorrida ou CEPs; CIF ou FOB; dedicado ou dividido', responsavel: 'Ulisses', categoria: 'Escopo 3: Transporte e distribuição (upstream)' },
    { unidade: 'Manaus, Cajamar, Araçariguama e MK Sul', tema: 'Logística Reversa', responsavel: '', categoria: 'Escopo 3: Transporte e distribuição (upstream)' },
    { unidade: 'Manaus, Cajamar, Araçariguama e MK Sul', tema: 'Cabotagem (Manaus)', responsavel: '', categoria: 'Escopo 3: Transporte e distribuição (upstream)' },
    { unidade: 'Jacuípe (MKBR, MK Nordeste, MK NE)', tema: 'Modal, tipo de veículo, combustível, tonelada, distância percorrida ou CEPs; CIF ou FOB; dedicado ou dividido', responsavel: 'Taimonn', categoria: 'Escopo 3: Transporte e distribuição (upstream)' },
    { unidade: 'Jacuípe (MKBR, MK Nordeste, MK NE)', tema: 'Logística Reversa', responsavel: '', categoria: 'Escopo 3: Transporte e distribuição (upstream)' },
    { unidade: 'Jacuípe (MKBR, MK Nordeste, MK NE)', tema: 'Correio', responsavel: '', categoria: 'Escopo 3: Transporte e distribuição (upstream)' },
    { unidade: 'Exportação', tema: 'Transporte marítimo', responsavel: 'Ulisses', categoria: 'Escopo 3: Transporte e distribuição (upstream)' },
    { unidade: 'Manaus', tema: 'Volume de resíduos (papel, madeira, orgânicos, …)', responsavel: 'Paulo Maciel', categoria: 'Escopo 3: Resíduos gerados nas operações' },
    { unidade: 'Jacuípe', tema: 'Volume de resíduos (papel, madeira, orgânicos, …)', responsavel: 'Gabriela Alves', categoria: 'Escopo 3: Resíduos gerados nas operações' },
    { unidade: 'MK Sul', tema: 'Volume de resíduos (papel, madeira, orgânicos, …)', responsavel: 'Suellen', categoria: 'Escopo 3: Resíduos gerados nas operações' },
    { unidade: 'Manaus', tema: 'Viagens aéreas internacionais da unidade', responsavel: 'Bianca', categoria: 'Escopo 3: Viagens a negócios' },
    { unidade: 'Barueri', tema: 'Viagens aéreas nacionais e internacionais, hospedagem, locação de veículo, Uber, vans e helicóptero', responsavel: 'Roberto / Gabriela', categoria: 'Escopo 3: Viagens a negócios' },
    { unidade: 'Jacuípe', tema: 'Táxis (Raimundo)', responsavel: 'Ingredy', categoria: 'Escopo 3: Viagens a negócios' },
    { unidade: 'Manaus', tema: 'Funcionários que usam fretado; distância percorrida/CEPs; km para prestação de serviço', responsavel: 'Denis Ozório', categoria: 'Escopo 3: Deslocamento de funcionários' },
    { unidade: 'Barueri', tema: 'Funcionários (CEPs dos colaboradores e do CD); distância percorrida; cartão e ônibus', responsavel: 'Thuane', categoria: 'Escopo 3: Deslocamento de funcionários' },
    { unidade: 'Barueri', tema: 'Quantidade de funcionários das unidades', responsavel: '', categoria: 'Escopo 3: Deslocamento de funcionários' },
    { unidade: 'Jacuípe', tema: 'Quantidade de funcionários das unidades', responsavel: 'Silvio', categoria: 'Escopo 3: Deslocamento de funcionários' },

    // Escopo 2 — Consumo de energia elétrica adquirida da rede (por unidade)
    { unidade: 'SP Barueri', tema: 'Consumo de eletricidade da unidade (faturas de energia)', responsavel: 'Gabriela (contas a pagar)', categoria: 'Escopo 2: Aquisição de energia elétrica' },
    { unidade: 'Araçariguama', tema: 'Consumo de eletricidade da unidade (faturas de energia)', responsavel: 'Roberval / Suellen', categoria: 'Escopo 2: Aquisição de energia elétrica' },
    { unidade: 'MK Sul', tema: 'Consumo de eletricidade da unidade (faturas de energia)', responsavel: 'Roberval / Adriano Machado', categoria: 'Escopo 2: Aquisição de energia elétrica' },
    { unidade: 'Cajamar', tema: 'Consumo de eletricidade da unidade (faturas de energia)', responsavel: 'Roberval / Marcio Valeriano', categoria: 'Escopo 2: Aquisição de energia elétrica' },

    // Escopo 1 — Combustão de gases (GLP / empilhadeiras) terceirizados
    { unidade: 'Araçariguama', tema: 'Consumo de gases (GLP / empilhadeiras) — terceirizado', responsavel: 'Roberval / Suellen', categoria: 'Escopo 1: Combustão estacionária' },
    { unidade: 'MK Sul', tema: 'Consumo de gases (GLP / empilhadeiras) — terceirizado', responsavel: 'Roberval / Adriano Machado', categoria: 'Escopo 1: Combustão estacionária' },
    { unidade: 'Cajamar', tema: 'Consumo de gases (GLP / empilhadeiras) — terceirizado', responsavel: 'Roberval / Marcio Valeriano', categoria: 'Escopo 1: Combustão estacionária' },
];
