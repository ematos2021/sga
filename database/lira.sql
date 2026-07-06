-- ════════════════════════════════════════════════════════════════════════
--  SGA — LIRA (Levantamento de Requisitos Legais) · tabela lira_geral
--
--  1) Adiciona o rastreio de análise (quem analisou e quando) — é o que
--     permite acompanhar a meta diária de 5 análises.
--  2) Cria a view lira_analises com nomes ASCII: o gateway do Supabase
--     rejeita colunas acentuadas na query string, então o app fala apenas
--     com a view (que é atualizável, por ser espelho simples da tabela).
--
--  Como aplicar: Supabase → SQL Editor → New query → cole tudo → Run.
--  Seguro de rodar mais de uma vez.
-- ════════════════════════════════════════════════════════════════════════

alter table public.lira_geral add column if not exists analisado_em  timestamptz;
alter table public.lira_geral add column if not exists analisado_por text;

create index if not exists idx_lira_analisado_em on public.lira_geral (analisado_em);

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
    analisado_por
from public.lira_geral;
