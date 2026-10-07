import ExcelJS from "exceljs";
import { ESCOLA } from "@/lib/escola";

export const dynamic = "force-dynamic";

function paraBytes(buffer: unknown): ArrayBuffer {
  if (buffer instanceof ArrayBuffer) return buffer;
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayLike<number>);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de Arquivo Morto Escolar";

  const planilha = workbook.addWorksheet("Prontuários");
  planilha.columns = [
    { header: "RM", key: "rm", width: 16 },
    { header: "NOME", key: "nome", width: 32 },
    { header: "SOBRENOME", key: "sobrenome", width: 32 },
    { header: "OBSERVAÇÕES", key: "observacoes", width: 46 },
  ];

  const cabecalho = planilha.getRow(1);
  cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  cabecalho.height = 22;

  planilha.addRow({ rm: "123456", nome: "Maria", sobrenome: "Silva Souza", observacoes: "" });
  planilha.addRow({ rm: "123457", nome: "João", sobrenome: "Pereira Lima", observacoes: "" });
  planilha.addRow({ rm: "A2045", nome: "Ana Clara", sobrenome: "Ferreira", observacoes: "Prontuário transferido em 2021" });

  const instrucoes = workbook.addWorksheet("Instruções");
  instrucoes.columns = [{ key: "texto", width: 110 }];
  const linhas = [
    ESCOLA.identificacao,
    "COMO MONTAR A PLANILHA DE IMPORTAÇÃO",
    "",
    "1. A aba de dados deve conter as colunas obrigatórias: RM, NOME e SOBRENOME.",
    "2. A coluna OBSERVAÇÕES é opcional e será importada quando existir.",
    "3. A ordem das colunas não importa: o sistema identifica os cabeçalhos automaticamente.",
    "4. Nomes de cabeçalho aceitos para o RM: RM, RA, REGISTRO, MATRÍCULA, CÓDIGO.",
    "5. A coluna de observações também aceita os títulos OBS, NOTAS e COMENTÁRIOS.",
    "6. Nome de cabeçalho aceito para o primeiro nome: NOME, NOME DO ALUNO, ALUNO, ESTUDANTE.",
    "7. Nome de cabeçalho aceito para o sobrenome: SOBRENOME, ÚLTIMO NOME, NOME DE FAMÍLIA.",
    "8. Se o RM já existir no arquivo morto, o registro (nome, sobrenome e observações) será atualizado.",
    "9. Linhas sem RM, NOME ou SOBRENOME são ignoradas e aparecem no relatório de conferência.",
    "10. Após o envio, o sistema mostra uma prévia e só grava os dados depois da confirmação.",
    "",
    "Formatos aceitos: .xlsx, .xlsm e .csv",
  ];
  linhas.forEach((texto, indice) => {
    const linha = instrucoes.addRow({ texto });
    if (indice === 0) linha.font = { bold: true, size: 12, color: { argb: "FF0F766E" } };
    if (indice === 1) linha.font = { bold: true, size: 12 };
  });

  const conteudo = paraBytes(await workbook.xlsx.writeBuffer());

  return new Response(conteudo, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-arquivo-morto.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
