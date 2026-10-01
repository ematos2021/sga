-- ════════════════════════════════════════════════════════════════
--  waste_management_registry · separa as duas categorias de aterro
--
--  O cadastro tem uma ficha única "ATERRO COMUM E ENGRADADO", então ao
--  registrar o manifesto não dá para dizer qual das duas saiu — e elas
--  têm manuseio e cobrança diferentes. Os manifestos antigos JÁ usam os
--  dois nomes separados; só a ficha estava junta.
--
--  Este script cria as duas fichas copiando todos os campos da ficha
--  combinada (classe, destinador, transportadores, ONU…), sem apagar
--  nada. Rode no SQL Editor do Supabase; pode rodar mais de uma vez.
-- ════════════════════════════════════════════════════════════════

-- ─── 1. ATERRO COMUM ───
INSERT INTO waste_management_registry (
    waste_type, category, ibama_code,
    physical_state, waste_class, packaging, unit, weight, treatment,
    destinator_name, destinator_cnpj,
    temp_storage_name, temp_storage_cnpj,
    transporter_1_name, transporter_1_cnpj,
    transporter_2_name, transporter_2_cnpj,
    transporter_3_name, transporter_3_cnpj,
    transporter_4_name, transporter_4_cnpj,
    onu_number, risk_class, shipping_name, packaging_group
)
SELECT
    'ATERRO COMUM', category, ibama_code,
    physical_state, waste_class, packaging, unit, weight, treatment,
    destinator_name, destinator_cnpj,
    temp_storage_name, temp_storage_cnpj,
    transporter_1_name, transporter_1_cnpj,
    transporter_2_name, transporter_2_cnpj,
    transporter_3_name, transporter_3_cnpj,
    transporter_4_name, transporter_4_cnpj,
    onu_number, risk_class, shipping_name, packaging_group
FROM waste_management_registry
WHERE waste_type = 'ATERRO COMUM E ENGRADADO'
  AND NOT EXISTS (
      SELECT 1 FROM waste_management_registry WHERE waste_type = 'ATERRO COMUM'
  )
LIMIT 1;

-- ─── 2. ATERRO ENGRADADO ───
INSERT INTO waste_management_registry (
    waste_type, category, ibama_code,
    physical_state, waste_class, packaging, unit, weight, treatment,
    destinator_name, destinator_cnpj,
    temp_storage_name, temp_storage_cnpj,
    transporter_1_name, transporter_1_cnpj,
    transporter_2_name, transporter_2_cnpj,
    transporter_3_name, transporter_3_cnpj,
    transporter_4_name, transporter_4_cnpj,
    onu_number, risk_class, shipping_name, packaging_group
)
SELECT
    'ATERRO ENGRADADO', category, ibama_code,
    physical_state, waste_class, packaging, unit, weight, treatment,
    destinator_name, destinator_cnpj,
    temp_storage_name, temp_storage_cnpj,
    transporter_1_name, transporter_1_cnpj,
    transporter_2_name, transporter_2_cnpj,
    transporter_3_name, transporter_3_cnpj,
    transporter_4_name, transporter_4_cnpj,
    onu_number, risk_class, shipping_name, packaging_group
FROM waste_management_registry
WHERE waste_type = 'ATERRO COMUM E ENGRADADO'
  AND NOT EXISTS (
      SELECT 1 FROM waste_management_registry WHERE waste_type = 'ATERRO ENGRADADO'
  )
LIMIT 1;

-- ─── Conferência ───
SELECT id, waste_type, waste_class, treatment, destinator_name
FROM waste_management_registry
WHERE waste_type LIKE 'ATERRO%'
ORDER BY waste_type;

-- ─── Limpeza opcional ───
-- A ficha combinada continua no cadastro de propósito: apagar linha de
-- banco não tem volta, e é você quem sabe se alguém ainda a usa. Se as
-- duas novas estiverem certas na conferência acima e você quiser sumir
-- com ela, rode a linha abaixo (ou exclua pela tela de Cadastros):
-- DELETE FROM waste_management_registry WHERE waste_type = 'ATERRO COMUM E ENGRADADO';
