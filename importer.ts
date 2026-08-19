import type { Employee, ImportStats, ImportType, Refueling } from './types';
import {
  calculateVolumeAndTotal,
  countDelimiterOutsideQuotes,
  createStableId,
  extractDateTime,
  findCol,
  getRefuelingFingerprint,
  isMeaningfulRefueling,
  normalizeHeader,
  parseDateRobust,
  parseDelimitedText,
  parseNumericValue
} from './utils';

export interface ParseResult {
  items: Array<Refueling | Employee>;
  stats: ImportStats;
}

const emptyResult = (): ParseResult => ({
  items: [],
  stats: { sourceRows: 0, acceptedRows: 0 }
});

export const parseImportText = (text: string, type: ImportType, ownerId: string): ParseResult => {
    // Remove BOM if exists
    const cleanText = text.replace(/^\uFEFF/, '');
    const firstLine = cleanText.split(/\r?\n/, 1)[0] || '';
    if (!firstLine.trim()) return emptyResult();

    const countSemi = countDelimiterOutsideQuotes(firstLine, ';');
    const countComma = countDelimiterOutsideQuotes(firstLine, ',');
    const countTab = countDelimiterOutsideQuotes(firstLine, '\t');
    let delimiter = ';';
    if (countTab > countSemi && countTab > countComma) delimiter = '\t';
    else if (countComma > countSemi) delimiter = ',';
    else delimiter = ';';

    const rows = parseDelimitedText(cleanText, delimiter);
    if (rows.length < 2) return emptyResult();

    const headers = rows[0].map(h => normalizeHeader(h));
    const result: Array<Refueling | Employee> = [];
    let acceptedRows = 0;

    for (let i = 1; i < rows.length; i++) {
      try {
        const values = rows[i];
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (header) row[header] = values[index];
        });

        if (type === 'refueling') {
          // Log Horustech:
          // Coluna 1 (index 0): Registro
          // Coluna 2 (index 1): Bico
          // Coluna 3 (index 2): Prod.
          // Coluna 4 (index 3): Tanq
          // Coluna 5 (index 4): Total (Total de Vendas)
          // Coluna 6 (index 5): Volume (Litros)
          // Coluna 7 (index 6): Preço Unitário (Preço de Venda / Pre)
          // Coluna 8 (index 7): Tempo
          // Coluna 9 (index 8): Data
          // Coluna 10 (index 9): Hora
          // Coluna 11 (index 10): Encerrante Inicial
          // Coluna 12 (index 11): Encerrante Final
          // Coluna 13 (index 12): ID Frentista
          const registroVal = findCol(row, values, ['registro', 'reg', 'num_registro', 'id_registro'], 0);
          const frentistaId = findCol(row, values, ['id frentista', 'id_frentista', 'frentista', 'id frent', 'cartao', 'card', 'id frentista 1', 'id_frent'], 12) || 'N/A';
          const dateRaw = findCol(row, values, ['data', 'date', 'data_hora', 'data hora', 'dt abast', 'datahora', 'timestamp'], 8);
          const horaRaw = findCol(row, values, ['hora', 'hour', 'time', 'hr abast'], 9);
          const bicoRaw = findCol(row, values, ['bico', 'id_bico', 'id bico', 'nozzle', 'num bico', 'bico id'], 1) || 'B?';

          let encInicial = parseNumericValue(findCol(row, values, ['enc inicial', 'enc_inicial', 'enc. inicial', 'enc.inicial', 'encinicial', 'totals_volume_init', 'encerrante inicial', 'encerrante_inicial', 'inicial', 'reading start'], 10));
          let encFinal = parseNumericValue(findCol(row, values, ['enc final', 'enc_final', 'enc. final', 'enc.final', 'encfinal', 'totals_volume_final', 'encerrante final', 'encerrante_final', 'final', 'reading end'], 11));
          let rawVolume = parseNumericValue(findCol(row, values, ['volume', 'litros', 'litro', 'quantidade', 'liters', 'vol', 'qtd', 'litragem'], 5));
          let rawTotal = parseNumericValue(findCol(row, values, ['total', 'valor', 'valor_total', 'valor total', 'valortotal', 'price', 'total venda', 'total abastecimento', 'vlr total'], 4));
          let rawPreco = parseNumericValue(findCol(row, values, ['preco', 'preço', 'preco unitario', 'preço unitário', 'preco_unitario', 'pre', 'unit price', 'unit_price', 'preco de venda', 'preço de venda', 'valor unitario'], 6));

          const origemVolumeVazio = rawVolume <= 0;
          const origemTotalVazio = rawTotal <= 0;
          const origemPrecoVazio = rawPreco <= 0;

          // Executa a regra solicitada: quando total e volume estiverem vazios/zerados,
          // volume = encFinal - encInicial, e total = volume * preco
          const { volume, valorTotal, precoUnitario } = calculateVolumeAndTotal(rawVolume, rawTotal, rawPreco, encInicial, encFinal);

          const newItem: Refueling = {
            id: '',
            id_frentista: String(frentistaId).trim(),
            data: parseDateRobust(dateRaw),
            hora: String(horaRaw || '').trim(),
            bico: String(bicoRaw).trim(),
            valor: valorTotal,
            litros: volume,
            preco_unitario: precoUnitario,
            enc_inicial: encInicial,
            enc_final: encFinal,
            ownerId,
            linhaPlanilha: i + 1,
            registro: registroVal ? String(registroVal).trim() : '',
            origemVolumeVazio,
            origemTotalVazio,
            origemPrecoVazio,
            rawVolumeOriginal: rawVolume,
            rawTotalOriginal: rawTotal,
            rawPrecoOriginal: rawPreco
          };
          if (isMeaningfulRefueling(newItem)) {
            newItem.id = createStableId(getRefuelingFingerprint(newItem));
            result.push(newItem);
            acceptedRows += 1;
          }
        } else if (type === 'comcept') {
          // Formato Log Concept:
          // Coluna 2 (index 1): Valor Total (total)
          // Coluna 3 (index 2): Volume (volume)
          // Coluna 4 (index 3): Preço Unitário (price)
          // Coluna 6 (index 5): Data (date)
          // Coluna 7 (index 6): Hora (hour)
          // Coluna 9 (index 8): Encerrante Inicial (totals_volume_init)
          // Coluna 10 (index 9): Encerrante Final (totals_volume_final)
          // Coluna 13 (index 12): Card Frentista (card_attendant / attendant_name)
          // Coluna 15 (index 14): Bico (nozzle)
          const registroVal = findCol(row, values, ['id', 'registro', 'transacao', 'id_abast'], 0);
          const frentistaId = findCol(row, values, ['attendant_name', 'attendant name', 'card_attendant', 'card attendant', 'id_frentista', 'frentista', 'cartao'], 12) || 'N/A';
          const bicoRaw = findCol(row, values, ['nozzle', 'bico', 'id_bico', 'bico_id'], 14) || 'B?';
          const dateRaw = findCol(row, values, ['date', 'data', 'data_hora'], 5);
          const horaRaw = findCol(row, values, ['hour', 'hora', 'time'], 6);

          let encInicial = parseNumericValue(findCol(row, values, ['totals_volume_init', 'enc_inicial', 'enc inicial', 'enc. inicial', 'inicial'], 8));
          let encFinal = parseNumericValue(findCol(row, values, ['totals_volume_final', 'enc_final', 'enc final', 'enc. final', 'final'], 9));
          let rawVolume = parseNumericValue(findCol(row, values, ['volume', 'litros', 'litro', 'quantidade'], 2));
          let rawTotal = parseNumericValue(findCol(row, values, ['total', 'valor', 'valor_total', 'price'], 1));
          let rawPreco = parseNumericValue(findCol(row, values, ['price', 'preco', 'preço', 'preco_unitario'], 3));

          const origemVolumeVazio = rawVolume <= 0;
          const origemTotalVazio = rawTotal <= 0;
          const origemPrecoVazio = rawPreco <= 0;

          const { volume, valorTotal, precoUnitario } = calculateVolumeAndTotal(rawVolume, rawTotal, rawPreco, encInicial, encFinal);

          const newItem: Refueling = {
            id: '',
            id_frentista: String(frentistaId).trim(),
            data: parseDateRobust(dateRaw),
            hora: String(horaRaw || '').trim(),
            bico: String(bicoRaw).trim(),
            valor: valorTotal,
            litros: volume,
            preco_unitario: precoUnitario,
            enc_inicial: encInicial,
            enc_final: encFinal,
            ownerId,
            linhaPlanilha: i + 1,
            registro: registroVal ? String(registroVal).trim() : '',
            origemVolumeVazio,
            origemTotalVazio,
            origemPrecoVazio,
            rawVolumeOriginal: rawVolume,
            rawTotalOriginal: rawTotal,
            rawPrecoOriginal: rawPreco
          };
          if (isMeaningfulRefueling(newItem)) {
            newItem.id = createStableId(getRefuelingFingerprint(newItem));
            result.push(newItem);
            acceptedRows += 1;
          }
        } else if (type === 'hiro') {
          // Formato Log Hiro:
          // 1ª coluna (index 0): Número do Bico
          // 3ª coluna (index 2): Data e Hora (no mesmo campo, ex: "30/03/2026  03:54:00")
          // 4ª coluna (index 3): Preço de Venda
          // 5ª coluna (index 4): Litro Vendido (Volume)
          // 6ª coluna (index 5): Total do Abastecimento (Valor Total)
          // 7ª coluna (index 6): Encerrante Inicial
          // 8ª coluna (index 7): Encerrante Final
          // 10ª coluna (index 9): Cartão do Funcionário
          const registroVal = findCol(row, values, ['registro', 'id', 'transacao', 'cod'], 1);
          const bicoRaw = findCol(row, values, ['nozzle', 'bico', 'nozzle_number', 'num_bico'], 0) || 'B?';
          let dateRaw = findCol(row, values, ['date', 'data', 'data_hora', 'data hora', 'data/hora'], 2);
          const frentistaId = findCol(row, values, ['card_attendant', 'id_frentista', 'cartao', 'card', 'funcionario'], 9) || 'N/A';

          let encInicial = parseNumericValue(findCol(row, values, ['totals_volume_init', 'enc_inicial', 'enc inicial', 'enc. inicial', 'inicial'], 6));
          let encFinal = parseNumericValue(findCol(row, values, ['totals_volume_final', 'enc_final', 'enc final', 'enc. final', 'final'], 7));
          let rawVolume = parseNumericValue(findCol(row, values, ['volume', 'litros', 'litro', 'litro vendido'], 4));
          let rawTotal = parseNumericValue(findCol(row, values, ['total', 'valor', 'valor_total', 'total do abastecimento'], 5));
          let rawPreco = parseNumericValue(findCol(row, values, ['price', 'preco', 'preço', 'preco_unitario', 'preco de venda'], 3));

          const origemVolumeVazio = rawVolume <= 0;
          const origemTotalVazio = rawTotal <= 0;
          const origemPrecoVazio = rawPreco <= 0;

          const { dateIso, horaStr } = extractDateTime(dateRaw);
          let horaRaw = findCol(row, values, ['hour', 'hora', 'time']) || horaStr;

          const { volume, valorTotal, precoUnitario } = calculateVolumeAndTotal(rawVolume, rawTotal, rawPreco, encInicial, encFinal);

          const newItem: Refueling = {
            id: '',
            id_frentista: String(frentistaId).trim(),
            data: dateIso,
            hora: String(horaRaw || '').trim(),
            bico: String(bicoRaw).trim(),
            valor: valorTotal,
            litros: volume,
            preco_unitario: precoUnitario,
            enc_inicial: encInicial,
            enc_final: encFinal,
            ownerId,
            linhaPlanilha: i + 1,
            registro: registroVal ? String(registroVal).trim() : '',
            origemVolumeVazio,
            origemTotalVazio,
            origemPrecoVazio,
            rawVolumeOriginal: rawVolume,
            rawTotalOriginal: rawTotal,
            rawPrecoOriginal: rawPreco
          };
          if (isMeaningfulRefueling(newItem)) {
            newItem.id = createStableId(getRefuelingFingerprint(newItem));
            result.push(newItem);
            acceptedRows += 1;
          }
        } else {
          const nome = values[0] || row['nome'] || row['funcionario'] || '';
          let cartao1 = "";
          let cartao2 = "";
          let cartao3 = "";

          if (values.length === 4) {
            cartao1 = (values[1] || "").trim();
            cartao2 = (values[2] || "").trim();
            cartao3 = (values[3] || "").trim();
          } else {
            cartao1 = (values[2] || row['id_cartao_abast'] || row['id cartao abast'] || "").trim();
            cartao2 = (values[3] || row['id_cartao_abast_2'] || row['id cartao abast 2'] || "").trim();
            cartao3 = (values[4] || row['id_cartao_abast_3'] || row['id cartao abast 3'] || "").trim();
          }

          const cards = [cartao1, cartao2, cartao3].filter(c => c.length > 0);

          if (nome && cards.length > 0) {
            cards.forEach(card => {
              result.push({ id_cartao: card, nome: String(nome).trim() });
            });
            acceptedRows += 1;
          }
        }
      } catch (err) { console.warn(`Erro ao processar linha ${i + 1}:`, err); }
    }
    return { items: result, stats: { sourceRows: rows.length - 1, acceptedRows } };
};
