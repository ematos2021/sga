-- ════════════════════════════════════════════════════════════════
--  waste_manifests · especificação da categoria de aterro
--
--  Até aqui a destinação do manifesto era SEMPRE deduzida do nome do
--  resíduo na leitura (classificaDestinacao em src/lib/importManifestos.js)
--  e nunca chegava ao banco: escolher outra no formulário não sobrevivia
--  ao recarregar. Como "Aterro Comum" e "Aterro Engradado" têm manuseio e
--  cobrança diferentes e isso NÃO está no nome do resíduo, a destinação
--  passa a ter coluna própria.
--
--  Rode este arquivo no SQL Editor do Supabase ANTES de salvar manifestos
--  novos — o app já envia disposal_type no insert/update.
--  Pode rodar mais de uma vez: é idempotente.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE waste_manifests
    ADD COLUMN IF NOT EXISTS disposal_type text;

COMMENT ON COLUMN waste_manifests.disposal_type IS
    'Destinação escolhida no manifesto (Reciclagem, Coprocessamento, Aterro Comum, Aterro Engradado…). NULL = o app deduz pelo nome do resíduo.';

-- ─── Backfill só das linhas de aterro ───
-- Mesma porta de entrada do classificador em JS: a linha só é aterro se o
-- nome do resíduo disser isso. Dentro do aterro, só afirma "engradado"
-- quando o nome traz a palavra — o resto entra como comum e quem souber o
-- contrário corrige manifesto por manifesto no formulário.
-- As demais destinações ficam NULL de propósito: continuam deduzidas na
-- leitura, sem risco de o banco e o código divergirem.
UPDATE waste_manifests
SET disposal_type = CASE
        WHEN upper(waste_type) ~ 'ENGRAD' THEN 'Aterro Engradado'
        ELSE 'Aterro Comum'
    END
WHERE disposal_type IS NULL
  AND upper(waste_type) ~ 'ATERRO|ENTULHO|CONTAMINAD|REJEITO|LIXO';

-- Conferência: quantos manifestos ficaram em cada categoria de aterro
-- SELECT disposal_type, count(*) FROM waste_manifests
-- WHERE disposal_type LIKE 'Aterro%' GROUP BY disposal_type ORDER BY 1;
