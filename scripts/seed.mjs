/**
 * Popula o arquivo morto com registros de demonstração.
 * Uso: node scripts/seed.mjs
 */
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/app_db";

function normalize(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NOMES = [
  "Maria", "João", "Ana", "Pedro", "Lucas", "Beatriz", "Gabriel", "Larissa",
  "Rafael", "Camila", "Bruno", "Júlia", "Matheus", "Sofia", "Gustavo", "Helena",
  "Thiago", "Isabela", "Vinícius", "Letícia", "Caio", "Manuela", "Felipe", "Aline",
  "Diego", "Nathália", "Rodrigo", "Bruna", "André", "Carolina", "Otávio", "Vanessa",
];

const SOBRENOMES = [
  "Silva Souza", "Pereira Lima", "Oliveira Santos", "Almeida Costa", "Ferreira Rocha",
  "Rodrigues Alves", "Barbosa Ribeiro", "Carvalho Dias", "Martins Teixeira", "Araújo Nunes",
  "Gomes Moreira", "Batista Cardoso", "Moraes Pires", "Correia Freitas", "Mendes Campos",
  "Nascimento Vale", "Duarte Peixoto", "Ramos Vasconcelos", "Fonseca Braga", "Tavares Azevedo",
  "Lopes Quintela", "Machado Brito", "Fernandes Prado", "Antunes Farias",
];

function pseudoaleatorio(semente) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

const rand = pseudoaleatorio(20260101);
const registros = [];
const rms = new Set();

let indice = 0;
while (registros.length < 84) {
  indice += 1;
  const nome = NOMES[Math.floor(rand() * NOMES.length)];
  const sobrenome = SOBRENOMES[Math.floor(rand() * SOBRENOMES.length)];
  const rm = String(100000 + Math.floor(rand() * 899999));
  if (rms.has(rm)) continue;
  rms.add(rm);

  const observacoes =
    indice % 11 === 0 ? "Prontuário com pendência de documentação (histórico escolar incompleto)." : null;

  registros.push({ rm, nome, sobrenome, observacoes });
}

// Alguns nomes com conjuntos de sobrenome repetidos para a busca por sobrenome ser útil.
registros.push(
  { rm: "200101", nome: "Ana Clara", sobrenome: "Silva Souza", observacoes: null },
  { rm: "200102", nome: "Carlos Eduardo", sobrenome: "Silva Souza", observacoes: null },
  { rm: "200103", nome: "Fernanda", sobrenome: "Silva Souza", observacoes: null },
  { rm: "200104", nome: "Maria", sobrenome: "Pereira Lima", observacoes: null },
  { rm: "200105", nome: "Ana Beatriz", sobrenome: "Pereira Lima", observacoes: null },
  { rm: "200106", nome: "Mariana", sobrenome: "Pereira Lima", observacoes: null },
);

const client = new pg.Client({ connectionString });
await client.connect();

const { rows: existentes } = await client.query("select count(*)::int as total from prontuarios");
console.log(`Registros já existentes: ${existentes[0].total}`);

let inseridos = 0;
for (const registro of registros) {
  const resultado = await client.query(
    `insert into prontuarios (rm, nome, sobrenome, nome_busca, sobrenome_busca, observacoes)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (rm) do nothing`,
    [
      registro.rm,
      registro.nome,
      registro.sobrenome,
      normalize(registro.nome),
      normalize(registro.sobrenome),
      registro.observacoes,
    ],
  );
  inseridos += resultado.rowCount ?? 0;
}

const { rows: historico } = await client.query("select count(*)::int as total from importacoes");
if (historico[0].total === 0) {
  await client.query(
    `insert into importacoes (arquivo, modo, total_linhas, inseridos, atualizados, ignorados, erros, created_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, now() - interval '6 days')`,
    [
      "arquivo-morto-2008-2020.xlsx",
      "importacao",
      89,
      84,
      3,
      2,
      JSON.stringify([
        { linha: 12, mensagem: "Sobrenome não informado." },
        { linha: 47, mensagem: "RM 10023A repetido na planilha (a linha 21 já foi considerada)." },
      ]),
    ],
  );
  console.log("Histórico de importação de demonstração criado.");
}

const { rows: totalFinal } = await client.query("select count(*)::int as total from prontuarios");
console.log(`Inseridos nesta execução: ${inseridos}`);
console.log(`Total de prontuários no arquivo morto: ${totalFinal[0].total}`);

await client.end();
