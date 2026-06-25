// ════════════════════════════════════════════════════════════════
//  Exportação para Excel (.xlsx) — atende os "Controle ... no Excel"
// ════════════════════════════════════════════════════════════════
import * as XLSX from 'xlsx';

/**
 * Exporta um array de objetos já formatados (cabeçalho = chaves) para .xlsx
 * @param {Array<Object>} rows  Linhas (objetos planos, chave = título da coluna)
 * @param {string} filename     Nome do arquivo (sem extensão)
 * @param {string} sheetName    Nome da aba
 */
export function exportToExcel(rows, filename, sheetName = 'Dados') {
    if (!rows || rows.length === 0) {
        alert('Não há dados para exportar.');
        return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    // largura automática aproximada
    const cols = Object.keys(rows[0]).map((k) => ({
        wch: Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)) + 2,
    }));
    ws['!cols'] = cols;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${filename}_${stamp}.xlsx`);
}
