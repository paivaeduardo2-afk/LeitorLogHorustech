import { parseImportText } from '../importer';
import type { Employee, Refueling } from '../types';
import {
  calculateVolumeAndTotal,
  parseDateRobust,
  parseDelimitedText,
  parseNumericValue,
  sumRefuelingTotals
} from '../utils';

let failures = 0;

const test = (name: string, run: () => void): void => {
  try {
    run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
};

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertEqual = <T>(actual: T, expected: T, message: string): void => {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}. Esperado: ${String(expected)}; recebido: ${String(actual)}`);
  }
};

test('converte números brasileiros e internacionais', () => {
  assertEqual(parseNumericValue('R$ 1.234,56'), 1234.56, 'Formato brasileiro incorreto');
  assertEqual(parseNumericValue('1,234.56'), 1234.56, 'Formato internacional incorreto');
  assertEqual(parseNumericValue('5,799'), 5.799, 'Decimal com vírgula incorreto');
});

test('rejeita datas impossíveis', () => {
  assertEqual(parseDateRobust('31/02/2026'), '', 'Data impossível deveria ser rejeitada');
  assert(parseDateRobust('19/08/2026 10:30:00').startsWith('2026-08-19'), 'Data válida não foi reconhecida');
});

test('lê CSV com delimitador e quebra de linha entre aspas', () => {
  const rows = parseDelimitedText('nome;observacao\n"Ana";"linha 1\nlinha 2"', ';');
  assertEqual(rows.length, 2, 'Quantidade de linhas incorreta');
  assertEqual(rows[1][1], 'linha 1\nlinha 2', 'Campo multilinha incorreto');
});

test('calcula volume e total pelos encerrantes', () => {
  const result = calculateVolumeAndTotal(0, 0, 5.5, 100, 110);
  assertEqual(result.volume, 10, 'Volume calculado incorretamente');
  assertEqual(result.valorTotal, 55, 'Total calculado incorretamente');
});

test('soma volume e total dos registros filtrados da auditoria', () => {
  const totals = sumRefuelingTotals([
    { litros: 10.25, valor: 60.5 },
    { litros: 4.75, valor: 28.25 }
  ]);

  assertEqual(totals.volume, 15, 'Somatório de volume incorreto');
  assertEqual(totals.total, 88.75, 'Somatório de valor incorreto');
});

test('importa Horustech e ignora linha com data inválida', () => {
  const csv = [
    'Registro;Bico;Prod;Tanq;Total;Volume;Preco;Tempo;Data;Hora;Enc Inicial;Enc Final;ID Frentista',
    '1;2;;;0;0;5,50;;19/08/2026;10:30:00;100;110;CARD-1',
    '2;2;;;55;10;5,50;;31/02/2026;10:31:00;110;120;CARD-1'
  ].join('\n');
  const result = parseImportText(csv, 'refueling', 'owner-1');
  const items = result.items as Refueling[];

  assertEqual(items.length, 1, 'Quantidade importada incorreta');
  assertEqual(result.stats.sourceRows, 2, 'Quantidade de linhas-fonte incorreta');
  assertEqual(result.stats.acceptedRows, 1, 'Quantidade aceita incorreta');
  assertEqual(items[0].litros, 10, 'Volume Horustech incorreto');
  assertEqual(items[0].valor, 55, 'Total Horustech incorreto');
  assertEqual(items[0].id_frentista, 'CARD-1', 'Cartão Horustech incorreto');
});

test('importa Concept pelos cabeçalhos', () => {
  const csv = [
    'id;total;volume;price;x;date;hour;x;totals_volume_init;totals_volume_final;x;x;card_attendant;x;nozzle',
    'C1;60;10;6;;19/08/2026;11:00:00;;200;210;;;CARD-C;;4'
  ].join('\n');
  const result = parseImportText(csv, 'comcept', 'owner-1');
  const item = result.items[0] as Refueling;

  assertEqual(result.items.length, 1, 'Registro Concept não importado');
  assertEqual(item.bico, '4', 'Bico Concept incorreto');
  assertEqual(item.valor, 60, 'Total Concept incorreto');
});

test('importa Hiro com data e hora combinadas', () => {
  const csv = [
    'bico;registro;data_hora;preco;volume;total;enc_inicial;enc_final;x;cartao',
    '3;H1;19/08/2026 12:15:30;5,90;10;59;300;310;;CARD-H'
  ].join('\n');
  const result = parseImportText(csv, 'hiro', 'owner-1');
  const item = result.items[0] as Refueling;

  assertEqual(result.items.length, 1, 'Registro Hiro não importado');
  assertEqual(item.hora, '12:15:30', 'Hora Hiro incorreta');
  assertEqual(item.id_frentista, 'CARD-H', 'Cartão Hiro incorreto');
});

test('importa vários cartões do mesmo funcionário', () => {
  const csv = 'Nome;Cartao 1;Cartao 2;Cartao 3\nMaria;10;11;12';
  const result = parseImportText(csv, 'employees', 'owner-1');
  const employees = result.items as Employee[];

  assertEqual(employees.length, 3, 'Quantidade de cartões incorreta');
  assert(employees.every(employee => employee.nome === 'Maria'), 'Nome do funcionário incorreto');
});

if (failures > 0) {
  console.error(`\n${failures} teste(s) falharam.`);
  process.exitCode = 1;
} else {
  console.log('\nTodos os testes passaram.');
}
