-- ════════════════════════════════════════════════════════════════════════
--  SGA — LIRA · Setor responsável pelo requisito
--
--  Adiciona a coluna "setor" (Manutenção, Logística, SESMT, Ambiental…)
--  e recria a view lira_analises incluindo-a ao final (CREATE OR REPLACE
--  permite acrescentar colunas no fim da view).
--
--  A classificação automática é feita pelo app (botão "Classificar
--  setores"), que grava aqui; o operador pode corrigir manualmente
--  no modal de análise.
--
--  Como aplicar: Supabase → SQL Editor → New query → cole tudo → Run.
--  Seguro de rodar mais de uma vez. Requer database/lira.sql já aplicado.
-- ════════════════════════════════════════════════════════════════════════

alter table public.lira_geral add column if not exists setor text;

create index if not exists idx_lira_setor on public.lira_geral (setor);

create or replace view public.lira_analises as
select
    id,
    "código"                        as codigo,
    "descrição_do_requisito"        as requisito,
    "sumário"                       as sumario,
    "descrição_da_obrigação"        as obrigacao,
    "evidência_obrigação"           as evidencia,
    "grupo_de_evidência"            as grupo_evidencia,
    penalidade,
    origem,
    temas,
    macrotemas,
    aplicabilidade,
    "situação_do_requisito"         as situacao,
    "prioridade_do_requisito"       as prioridade,
    "conformidade_da_obrigação"     as conformidade,
    "observaçõesconclusões"         as observacoes,
    analisado_em,
    analisado_por,
    setor
from public.lira_geral;
