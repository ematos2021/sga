-- ════════════════════════════════════════════════════════════════════════
--  SGA — LIRA · Revisão do setor dos requisitos PENDENTES (28/10/2026)
--
--  Feita sobre os 571 itens "Não Avaliado" da base (998 no total).
--  Mexe SÓ na coluna setor — conformidade não é tocada aqui.
--  Nada roda sozinho: o bloco 1 está pronto; os blocos 2 e 3 estão
--  comentados porque dependem de decisão de vocês.
--
--  Como aplicar: Supabase → SQL Editor → cole o bloco desejado → Run.
--  Cada bloco traz, ao lado, o comando para desfazer.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Erro claro ────────────────────────────────────────────────────────
-- Licença de estação de rádio (Anatel) estava em SESMT. É documento
-- administrativo, sem relação com segurança do trabalho.
update public.lira_geral set setor = 'Administrativo' where id = 401 and setor = 'SESMT';
-- desfazer: update public.lira_geral set setor = 'SESMT' where id = 401;


-- ── 2. Incêndio: hoje está em três áreas sem regra ───────────────────────
-- Hidrantes:  NBR 13714 → SESMT      |  IT 22 CBMBA (39 itens) → Manutenção
-- Extintores: NBR 12962 → SESMT      |  Portaria Inmetro 58 (15) → Manutenção
-- Extintores, sinalização e rotas de saída da IT 42 CBMBA (5) → Ambiental
-- Proposta de regra: sistema fixo (hidrante, bomba, alarme, detecção) fica
-- com Manutenção; extintor, sinalização e rota de fuga ficam com SESMT.
-- Se concordarem, descomentem:

-- update public.lira_geral set setor = 'Manutenção' where id = 254 and setor = 'SESMT';           -- NBR 13714 hidrantes
-- update public.lira_geral set setor = 'SESMT' where id in (861,862,863,865,867) and setor = 'Ambiental';  -- IT 42 pendentes
-- update public.lira_geral set setor = 'SESMT' where id between 786 and 800 and setor = 'Manutenção';     -- Inmetro 58 extintores

-- desfazer:
-- update public.lira_geral set setor = 'SESMT' where id = 254;
-- update public.lira_geral set setor = 'Ambiental' where id in (861,862,863,865,867);
-- update public.lira_geral set setor = 'Manutenção' where id between 786 and 800;
-- Obs.: a IT 42 tem outros 5 itens já Conforme em Ambiental; eles ficam onde estão.


-- ── 3. Resíduos do ambulatório (NR 32) ───────────────────────────────────
-- 10 itens sobre armazenamento e transporte de resíduo de serviço de saúde
-- estão em SESMT. Se o PGRSS é tocado pelo Ambiental, descomentem:

-- update public.lira_geral set setor = 'Ambiental' where id in (329,330,331,332,333,334,335,336,341,342) and setor = 'SESMT';
-- desfazer: update public.lira_geral set setor = 'SESMT' where id in (329,330,331,332,333,334,335,336,341,342);


-- ── 4. Provavelmente NÃO se aplicam (decisão da analista, não do setor) ──
-- Não há comando aqui: marcar "Não Aplicável" com justificativa é análise
-- de conformidade e deve ser feito no próprio SGA, item a item.
--   NR 32 · radiação ionizante, raio X, medicina nuclear, quimioterápicos,
--           gases medicinais (39): 293-296, 302, 303, 305, 315, 322, 337, 338,
--           339, 340, 345, 347-367, 371-374
--   ANP 937 · regra para DISTRIBUIDOR de solventes (15): 829-843
--   ANP 943 · regra para o COLETOR de óleo usado; para a Mondial vale exigir a
--           autorização do coletor (821). Os outros 7: 822-828
--   Inmetro 58 · regra para a EMPRESA que faz manutenção de extintor; para a
--           Mondial vale o 788 (extintor com selo). Os outros 14: 786, 787, 789-800
--   AGERSA 02 · itens marcados "prestadoras de abastecimento de água e
--           esgoto" (9): 601, 602, 603, 605, 606, 610, 612, 615, 622
--   NR 20 · "empresas de manutenção, inspeção, projeto e instalação" (2): 126, 127
--   Portaria ME 15.797 · medida da emergência de saúde pública (1): 777
--
--   NR 10 está duas vezes: versão antiga (ids 1-78, 66 pendentes) e
--   "VERSÃO 2026" (ids 926-996, 71 pendentes). Decidir qual vale e marcar a
--   outra antes de mandar para a Manutenção.
