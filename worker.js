export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {
      // TESTE DA API
      if (url.pathname === "/" && request.method === "GET") {
        return json({
          ok: true,
          mensagem: "API do Seminário Rotary funcionando"
        }, 200, corsHeaders);
      }

      // CADASTRAR PARTICIPANTE
      if (url.pathname === "/inscricao" && request.method === "POST") {
        const body = await request.json();

        const nome = String(body.nome || "").trim();
        const clube = String(body.clube || "").trim();
        const participacao = String(body.participacao || "").trim();

        if (!nome || !clube || !participacao) {
          return json({
            ok: false,
            erro: "Nome, clube e participação são obrigatórios."
          }, 400, corsHeaders);
        }

        if (
          participacao !== "Presencial" &&
          participacao !== "Online"
        ) {
          return json({
            ok: false,
            erro: "Modalidade de participação inválida."
          }, 400, corsHeaders);
        }

        const result = await env.DB
          .prepare(`
            INSERT INTO participantes
            (nome, clube, participacao)
            VALUES (?, ?, ?)
          `)
          .bind(nome, clube, participacao)
          .run();

        return json({
          ok: true,
          id: result.meta.last_row_id
        }, 201, corsHeaders);
      }

      // LISTAR PARTICIPANTES
      if (url.pathname === "/participantes" && request.method === "GET") {
        const result = await env.DB
          .prepare(`
            SELECT
              id,
              nome,
              clube,
              participacao,
              criado_em
            FROM participantes
            ORDER BY id DESC
          `)
          .all();

        return json({
          ok: true,
          participantes: result.results
        }, 200, corsHeaders);
      }

      return json({
        ok: false,
        erro: "Rota não encontrada."
      }, 404, corsHeaders);

    } catch (erro) {
      return json({
        ok: false,
        erro: "Erro interno da API.",
        detalhe: erro.message
      }, 500, corsHeaders);
    }
  }
};

function json(data, status, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...extraHeaders
    }
  });
}
