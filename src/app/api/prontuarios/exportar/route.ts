import ExcelJS from "exceljs";
import { ESCOLA } from "@/lib/escola";
import { listarProntuariosParaExportacao, parseFiltros } from "@/lib/server/prontuarios";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filtros = parseFiltros(url.searchParams);

  try {
    const registros = await listarProntuariosParaExportacao(filtros);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema de Arquivo Morto Escolar";
    workbook.created = new Date();

    const planilha = workbook.addWorksheet("Prontuários");
    planilha.columns = [
      { header: "RM", key: "rm", width: 16 },
      { header: "NOME", key: "nome", width: 32 },
      { header: "SOBRENOME", key: "sobrenome", width: 32 },
      { header: "OBSERVAÇÕES", key: "observacoes", width: 50 },
    ];

    // Cabeçalho institucional (linhas 1 e 2); a linha 3 recebe os títulos das colunas.
    const titulo = planilha.getRow(1);
    titulo.values = [ESCOLA.identificacao];
    titulo.font = { bold: true, size: 13, color: { argb: "FF134E4A" } };
    titulo.height = 20;

    const subtituloPlanilha = planilha.getRow(2);
    subtituloPlanilha.values = [
      `${ESCOLA.sistema.toUpperCase()} - PRONTUÁRIOS · exportado em ${new Date().toLocaleDateString("pt-BR")}`,
    ];
    subtituloPlanilha.font = { size: 10, color: { argb: "FF0F766E" } };
    subtituloPlanilha.height = 18;

    planilha.mergeCells("A1:D1");
    planilha.mergeCells("A2:D2");

    const cabecalho = planilha.getRow(3);
    cabecalho.values = ["RM", "NOME", "SOBRENOME", "OBSERVAÇÕES"];
    cabecalho.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cabecalho.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cabecalho.alignment = { vertical: "middle" };
    cabecalho.height = 22;

    registros.forEach((registro) => {
      planilha.addRow({
        rm: registro.rm,
        nome: registro.nome,
        sobrenome: registro.sobrenome,
        observacoes: registro.observacoes ?? "",
      });
    });

    planilha.autoFilter = { from: "A3", to: `D${registros.length + 3}` };
    planilha.views = [{ state: "frozen", ySplit: 3 }];

    const conteudo = paraBytes(await workbook.xlsx.writeBuffer());
    const data = new Date().toISOString().slice(0, 10);

    return new Response(conteudo, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="arquivo-morto-${data}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (erro) {
    console.error("[prontuarios:exportar]", erro);
    return Response.json({ mensagem: "Não foi possível gerar o arquivo de exportação." }, { status: 500 });
  }
}
