# Leitor de Log Horustech

Painel web para importar, consolidar e auditar logs de abastecimento nos formatos Horustech, Concept e Hiro. O processamento acontece no navegador e os dados ficam salvos localmente no dispositivo usado.

## Funcionalidades

- Importação de arquivos CSV, XLS e XLSX.
- Leitura dos layouts Horustech, Concept e Hiro.
- Cadastro de funcionários e associação de vários cartões ao mesmo frentista.
- Consolidação por frentista, bico, encerrante e preço de venda.
- Filtros por período, frentista e bico.
- Cálculo assistido de volume, total e preço unitário quando a origem está incompleta.
- Auditoria de encerrantes e campos vazios ou zerados.
- Prevenção de duplicidades ao importar novamente o mesmo arquivo.
- Persistência local dos dados no navegador.

## Executar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Verificações antes de publicar

```bash
npm run check
```

Esse comando executa a checagem TypeScript e o build de produção.

O arquivo `styles.css` é uma folha estática de produção gerada a partir de `styles.source.css`. Para regenerá-lo com o executável oficial do Tailwind CSS:

```bash
tailwindcss -i styles.source.css -o styles.css --minify
```

## Formatos esperados

### Horustech

O importador usa os cabeçalhos quando reconhecidos e mantém compatibilidade por posição com o layout tradicional: registro, bico, produto, tanque, total, volume, preço, tempo, data, hora, encerrante inicial, encerrante final e cartão do frentista.

### Concept

Compatível com total, volume, preço, data, hora, encerrantes, cartão/nome do frentista e bico. Cabeçalhos reconhecidos têm prioridade sobre as posições legadas.

### Hiro

Compatível com bico, data e hora, preço, volume, total, encerrantes e cartão do funcionário, incluindo leitura de planilhas Excel.

### Funcionários

A primeira coluna deve conter o nome. Os cartões podem ocupar as três colunas seguintes ou as colunas do layout legado. Um mesmo funcionário pode ter até três cartões no arquivo.

## Regras de integridade

- Uma data inválida não é substituída pela data atual; a linha é ignorada.
- Linhas sem data, bico ou qualquer valor útil de abastecimento são ignoradas.
- CSVs com campos entre aspas, aspas escapadas e quebras de linha internas são aceitos.
- Registros repetidos no arquivo ou já existentes no navegador não são adicionados novamente.
- Arquivos acima de 25 MB são recusados para proteger a estabilidade do navegador.

## Privacidade e limitações

Os abastecimentos e funcionários são armazenados em IndexedDB, que comporta arquivos maiores que o antigo `localStorage`. Na primeira abertura, os dados existentes são migrados automaticamente. Eles continuam pertencendo ao navegador e ao perfil em uso; limpar os dados do navegador também remove os dados do painel. Para uso simultâneo por vários usuários, histórico centralizado, permissões reais ou backup automático, será necessário adicionar uma API com banco de dados e autenticação.

A tela inicial atual é apenas uma entrada para o painel local; ela não constitui autenticação de segurança.
