/* Área da mentorada · Grupo Kovan */
(function () {
  var C = window.KOVAN_CONFIG;
  var app = document.getElementById("app");
  var topo = document.getElementById("topo-acoes");
  var hashTipo = new URLSearchParams(location.hash.slice(1)).get("type");
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, {
    auth: { detectSessionInUrl: true, persistSession: true, flowType: "implicit" }
  });
  var S = { sessao: null, perfil: null, lista: [], selId: null, aba: "plano", novo: false, msg: "", modelos: [] };
  var PROGRAMAS = ["Jornada Lapidar", "Mentoria Posicionadas", "Jornada da Liderança", "Plano de Voo", "Mentoria de Negócios", "Mentoria profissional", "Outra"];

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dataBR(iso, comHora) {
    if (!iso) return "Data a definir";
    var d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    var o = { weekday: "short", day: "2-digit", month: "short", year: "numeric" };
    if (comHora) { o.hour = "2-digit"; o.minute = "2-digit"; }
    return d.toLocaleString("pt-BR", o);
  }
  function diaCurto(iso) { return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }); }
  function paraInput(iso) {
    if (!iso) return "";
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function deInput(v) { return v ? new Date(v).toISOString() : null; }
  function hoje() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function traduz(e) {
    var m = (e && (e.message || e.erro)) || String(e || "");
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme o seu e-mail pelo convite recebido.";
    if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/rate limit/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    if (/already been registered/i.test(m)) return "Este e-mail já tem cadastro.";
    return m || "Algo deu errado. Tente novamente.";
  }
  function pinta(html) { app.innerHTML = html; }
  function urlRetorno() { return location.origin + location.pathname; }
  function fd(form) { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = typeof v === "string" ? v.trim() : v; }); return o; }
  function aviso(form, texto, ok) { var p = form.querySelector(".erro, .ok"); if (p) { p.textContent = texto; p.className = ok ? "ok" : "erro"; } }
  function ocupado(form, sim) { var b = form.querySelector("[type=submit]"); if (b) b.disabled = sim; }
  function linhas(arr) { return (arr || []).map(function (x) { return Array.isArray(x) ? x.join(" | ") : x; }).join("\n"); }
  function deLinhas(txt, pares) { return (txt || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { if (!pares) return l; var p = l.split("|"); return [p[0].trim(), (p[1] || "").trim()]; }); }
  function sel(nome, opcoes, atual) { return '<select name="' + nome + '">' + opcoes.map(function (o) { return '<option' + (o === atual ? " selected" : "") + '>' + o + '</option>'; }).join("") + '</select>'; }
  function hexNum(e) { return e.tipo === "diagnostico" ? "D" : e.tipo === "extra" ? "+" : String(e.numero).padStart(2, "0"); }

  function pintaTopo() {
    if (!S.sessao) { topo.innerHTML = '<a class="btn btn-cobre btn-pq" href="https://wa.me/' + C.WHATSAPP + '">Fale conosco</a>'; return; }
    var nome = (S.perfil && S.perfil.nome) || S.sessao.user.email;
    topo.innerHTML = '<span class="muted">' + esc(nome.split(" ")[0]) + (S.perfil && S.perfil.papel === "mentora" ? " · mentora" : "") + '</span><button class="btn btn-linha btn-pq" data-acao="sair">Sair</button>';
  }

  /* ---------- entrada ---------- */
  function telaLogin(modo) {
    S.sessao = null; pintaTopo();
    var esqueci = modo === "esqueci";
    pinta('<div class="centro"><div class="card login">' +
      '<div class="hex" style="width:46px;height:53px;margin:0 auto;background:var(--cobre)"></div>' +
      '<h1 style="text-align:center;font-size:24px;margin-top:14px">' + (esqueci ? "Recuperar senha" : "Área da mentorada") + '</h1>' +
      '<p class="muted" style="text-align:center;margin:6px 0 20px">' + (esqueci ? "Informe o seu e-mail e enviaremos um link para criar uma nova senha." : "Entre com o seu e-mail e a sua senha.") + '</p>' +
      '<form data-form="' + (esqueci ? "esqueci" : "login") + '" class="pilha" novalidate>' +
      '<label>E-mail<input name="email" type="email" autocomplete="email" required></label>' +
      (esqueci ? "" : '<label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>') +
      '<p class="erro" role="alert"></p>' +
      '<button class="btn btn-escuro" type="submit">' + (esqueci ? "Enviar link" : "Entrar") + '</button>' +
      '</form>' +
      '<p style="text-align:center;margin:14px 0 0"><button class="btn btn-texto" data-acao="' + (esqueci ? "ir-login" : "ir-esqueci") + '">' + (esqueci ? "← Voltar para o login" : "Esqueci a minha senha") + '</button></p>' +
      '</div></div>');
  }

  function telaSenha() {
    pintaTopo();
    var convite = hashTipo === "invite";
    pinta('<div class="centro"><div class="card login">' +
      '<p class="eyebrow" style="text-align:center">' + (convite ? "Boas-vindas" : "Nova senha") + '</p>' +
      '<h1 style="text-align:center;font-size:24px;margin-top:6px">' + (convite ? "Crie a sua senha de acesso" : "Defina a sua nova senha") + '</h1>' +
      '<p class="muted" style="text-align:center;margin:6px 0 20px">Use pelo menos 8 caracteres. Você vai usar esta senha sempre que entrar na sua área.</p>' +
      '<form data-form="senha" class="pilha" novalidate>' +
      '<label>Nova senha<input name="senha" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<label>Repita a senha<input name="senha2" type="password" autocomplete="new-password" minlength="8" required></label>' +
      '<p class="erro" role="alert"></p>' +
      '<button class="btn btn-cobre" type="submit">Salvar senha e entrar</button></form></div></div>');
  }

  async function rota() {
    var r = await sb.auth.getSession();
    S.sessao = r.data.session;
    if (!S.sessao) return telaLogin();
    var p = await sb.from("perfis").select("*").eq("id", S.sessao.user.id).single();
    S.perfil = p.data || { nome: "", papel: "mentorada" };
    pintaTopo();
    if (S.perfil.papel === "mentora") return painelMentora();
    return areaMentorada();
  }

  /* ---------- carregamento comum ---------- */
  async function carregaMentorias(somenteMinhas) {
    var q = sb.from("mentorias").select("*, mentorada:perfis(id,nome,email)").order("criado_em", { ascending: false });
    if (somenteMinhas) q = q.eq("mentorada_id", S.sessao.user.id);
    var r = await q;
    S.lista = r.data || [];
    if (!S.selId || !S.lista.some(function (m) { return m.id === S.selId; })) S.selId = S.lista.length ? S.lista[0].id : null;
  }
  function atual() { return S.lista.find(function (m) { return m.id === S.selId; }); }
  function abas(lista) {
    return '<div class="tabs" role="tablist">' + lista.map(function (a) {
      return '<button class="tab" role="tab" aria-selected="' + (S.aba === a[0]) + '" data-acao="aba" data-aba="' + a[0] + '">' + a[1] + '</button>';
    }).join("") + '</div>';
  }
  async function carregaModelos() {
    var r = await sb.from("modelos").select("id,nome,programa").order("nome");
    S.modelos = r.data || [];
  }
  function selectModelo(nome) {
    return '<select name="' + nome + '"><option value="">Sem modelo (em branco)</option>' + S.modelos.map(function (m) {
      return '<option value="' + m.id + '">' + esc(m.nome) + '</option>';
    }).join("") + '</select>';
  }

  /* ---------- painel da mentora ---------- */
  async function painelMentora() {
    await Promise.all([carregaMentorias(false), carregaModelos()]);
    var m = atual();
    var lat = '<aside class="lateral pilha"><button class="btn btn-cobre" data-acao="novo">+ Nova mentorada</button>' +
      (S.lista.length ? S.lista.map(function (x) {
        return '<button class="item" data-acao="sel" data-id="' + x.id + '" aria-current="' + (!S.novo && x.id === S.selId) + '">' +
          '<strong>' + esc(x.mentorada ? x.mentorada.nome || x.mentorada.email : "") + '</strong>' +
          '<span class="muted">' + esc(x.programa) + ' · <span class="pill">' + esc(x.status) + '</span></span></button>';
      }).join("") : '<p class="muted">Nenhuma mentorada ainda.</p>') + '</aside>';
    var corpo;
    if (S.novo || !m) corpo = formNova();
    else {
      corpo = '<p class="eyebrow">' + esc(m.programa) + '</p><h1 style="font-size:28px;margin-top:4px">' + esc(m.mentorada.nome || m.mentorada.email) + '</h1>' +
        '<p class="muted" style="margin:4px 0 0">' + esc(m.mentorada.email) + '</p>' +
        abas([["plano", "Plano"], ["encontros", "Encontros"], ["checkins", "Check-ins"], ["atividades", "Atividades"], ["testes", "Testes e ferramentas"]]) +
        '<div id="aba">Carregando…</div>';
    }
    pinta('<div class="wrap layout">' + lat + '<section class="principal">' + (S.msg ? '<p class="card ok" style="margin:0 0 16px">' + esc(S.msg) + '</p>' : "") + corpo + '</section></div>');
    S.msg = "";
    if (!S.novo && m) await abaMentora(m);
  }

  function formNova() {
    return '<div class="card"><p class="eyebrow">Nova mentorada</p><h1 style="font-size:24px;margin:4px 0 6px">Convidar para a plataforma</h1>' +
      '<p class="muted" style="margin:0 0 18px">Ela recebe um e-mail para criar a senha e acessar a área dela.</p>' +
      '<form data-form="nova" class="pilha" novalidate><div class="grid2">' +
      '<label>Nome completo<input name="nome" required></label>' +
      '<label>E-mail<input name="email" type="email" required></label>' +
      '<label>Programa' + sel("programa", PROGRAMAS, "Jornada Lapidar") + '</label>' +
      '<label>Data de início<input name="inicio" type="date"></label></div>' +
      '<label>Roteiro (modelo)' + selectModelo("modelo") + '</label>' +
      '<p class="muted" style="margin:0">O modelo preenche os encontros, a trilha, as entregas e os combinados. Depois você ajusta tudo do jeito dela.</p>' +
      '<p class="erro" role="alert"></p><button class="btn btn-escuro" type="submit">Enviar convite</button></form></div>';
  }

  async function abaMentora(m) {
    var alvo = document.getElementById("aba");
    if (S.aba === "plano") {
      alvo.innerHTML = '<form data-form="plano" class="card pilha" novalidate><div class="grid2">' +
        '<label>Programa<input name="programa" value="' + esc(m.programa) + '"></label>' +
        '<label>Status' + sel("status", ["ativa", "pausada", "concluida"], m.status) + '</label>' +
        '<label>Início<input name="inicio" type="date" value="' + esc(m.inicio || "") + '"></label>' +
        '<label>Término<input name="fim" type="date" value="' + esc(m.fim || "") + '"></label></div>' +
        '<label>Apresentação (aparece no topo da área dela)<textarea name="descricao" rows="5">' + esc(m.descricao) + '</textarea></label>' +
        '<label>O que ela fechou (proposta)<textarea name="proposta">' + esc(m.proposta) + '</textarea></label>' +
        '<label>Objetivos da mentoria<textarea name="objetivos">' + esc(m.objetivos) + '</textarea></label>' +
        '<label>Investimento e condições<input name="investimento" value="' + esc(m.investimento) + '"></label>' +
        '<label>Formato (uma linha por item: Título | valor)<textarea name="formato">' + esc(linhas(m.formato)) + '</textarea></label>' +
        '<label>A trilha (uma fase por linha: Fase | descrição)<textarea name="fases">' + esc(linhas(m.fases)) + '</textarea></label>' +
        '<label>O que ela leva (um item por linha)<textarea name="entregas">' + esc(linhas(m.entregas)) + '</textarea></label>' +
        '<label>Nossos combinados (um por linha)<textarea name="combinados">' + esc(linhas(m.combinados)) + '</textarea></label>' +
        '<p class="erro" role="alert"></p><button class="btn btn-escuro" type="submit">Salvar plano</button></form>' +
        '<form data-form="aplicar-modelo" class="card pilha" style="margin-top:16px" novalidate><p class="eyebrow">Aplicar um roteiro pronto</p>' +
        '<p class="muted" style="margin:0">Atenção: isso substitui todos os encontros desta mentorada pelos do modelo.</p>' +
        '<label>Modelo' + selectModelo("modelo") + '</label><p class="erro" role="alert"></p><button class="btn btn-linha btn-pq" type="submit" style="align-self:flex-start">Aplicar modelo</button></form>';
    } else if (S.aba === "encontros") {
      var r = await sb.from("encontros").select("*").eq("mentoria_id", m.id).order("numero").order("data");
      var lista = r.data || [];
      alvo.innerHTML = '<div class="pilha">' + lista.map(function (e) {
        return '<details class="encontro' + (e.status === "realizado" ? " feito" : "") + '"><summary><span class="hex num">' + hexNum(e) + '</span><span style="flex:1 1 200px"><span class="fase-tag">' + esc(e.fase) + (e.semana ? " · " + esc(e.semana) : "") + '</span><br><strong>' + esc(e.titulo) + '</strong><br><span class="muted">' + dataBR(e.data, true) + '</span></span><span class="pill' + (e.status === "realizado" ? " feito" : "") + '">' + esc(e.status) + '</span>' + (e.liberado ? "" : ' <span class="pill">não liberado</span>') + '</summary>' +
          '<form data-form="encontro" data-id="' + e.id + '" class="pilha" style="margin-top:14px" novalidate><div class="grid2">' +
          '<label>Título<input name="titulo" value="' + esc(e.titulo) + '"></label>' +
          '<label>Data e horário<input name="data" type="datetime-local" value="' + paraInput(e.data) + '"></label>' +
          '<label>Status' + sel("status", ["agendado", "realizado", "remarcado", "cancelado"], e.status) + '</label>' +
          '<label>Fase<input name="fase" value="' + esc(e.fase) + '"></label>' +
          '<label>Semana<input name="semana" value="' + esc(e.semana) + '"></label>' +
          '<label>Tema<input name="tema" value="' + esc(e.tema) + '"></label></div>' +
          '<label>Objetivo<textarea name="objetivo">' + esc(e.objetivo) + '</textarea></label>' +
          '<div class="grid2"><label>Ferramenta<input name="ferramenta" value="' + esc(e.ferramenta) + '"></label><label>Palavra (versículo)<input name="versiculo" value="' + esc(e.versiculo) + '"></label></div>' +
          '<label>Hora de executar (tarefa)<textarea name="tarefa">' + esc(e.tarefa) + '</textarea></label>' +
          '<label>Registro do encontro (ela vê)<textarea name="anotacoes_mentora">' + esc(e.anotacoes_mentora) + '</textarea></label>' +
          '<label style="flex-direction:row;align-items:center;gap:8px;font-size:15px"><input type="checkbox" name="liberado" style="width:22px;min-height:22px"' + (e.liberado ? " checked" : "") + '> Liberar o conteúdo para ela ver</label>' +
          '<div><p class="eyebrow" style="margin-bottom:6px">Reflexão da mentorada</p><div class="leitura">' + (esc(e.reflexao_mentorada) || '<span class="muted">Ainda sem reflexão.</span>') + '</div></div>' +
          '<p class="erro" role="alert"></p><div style="display:flex;flex-wrap:wrap;gap:10px"><button class="btn btn-escuro btn-pq" type="submit">Salvar encontro</button><button type="button" class="btn btn-texto" data-acao="apagar" data-tabela="encontros" data-id="' + e.id + '">Excluir</button></div></form></details>';
      }).join("") + '</div>' +
        '<form data-form="novo-encontro" class="card pilha" style="margin-top:16px" novalidate><p class="eyebrow">Adicionar encontro</p><div class="grid2">' +
        '<label>Título<input name="titulo" required></label><label>Data e horário<input name="data" type="datetime-local"></label></div>' +
        '<p class="erro" role="alert"></p><button class="btn btn-linha btn-pq" type="submit">Adicionar</button></form>';
    } else if (S.aba === "checkins") {
      var rc = await sb.from("checkins").select("*").eq("mentoria_id", m.id).order("dia", { ascending: false }).limit(60);
      var cs = rc.data || [];
      alvo.innerHTML = cs.length ? '<div class="pilha">' + cs.map(function (c) {
        return '<form data-form="comentario" data-id="' + c.id + '" class="card pilha" novalidate><strong>' + dataBR(c.dia) + '</strong>' +
          '<dl class="campos"><div><dt>O que fiz</dt><dd style="font-weight:400;white-space:pre-wrap">' + (esc(c.fiz) || "–") + '</dd></div><div><dt>O que adiei</dt><dd style="font-weight:400;white-space:pre-wrap">' + (esc(c.adiei) || "–") + '</dd></div><div><dt>Ação de amanhã</dt><dd style="font-weight:400;white-space:pre-wrap">' + (esc(c.acao_amanha) || "–") + '</dd></div></dl>' +
          '<label>Seu comentário (ela vê)<textarea name="comentario_mentora" rows="2">' + esc(c.comentario_mentora) + '</textarea></label><p class="erro" role="alert"></p><button class="btn btn-escuro btn-pq" type="submit" style="align-self:flex-start">Salvar comentário</button></form>';
      }).join("") + '</div>' : '<p class="muted">Ela ainda não fez nenhum check-in.</p>';
    } else if (S.aba === "atividades") {
      var ra = await sb.from("atividades").select("*").eq("mentoria_id", m.id).order("criado_em");
      var ats = ra.data || [];
      var regs = [];
      if (ats.length) {
        var rr = await sb.from("registros").select("*").in("atividade_id", ats.map(function (a) { return a.id; })).order("dia", { ascending: false }).limit(200);
        regs = rr.data || [];
      }
      alvo.innerHTML = '<div class="pilha">' + (ats.length ? ats.map(function (a) {
        var meus = regs.filter(function (g) { return g.atividade_id === a.id; });
        return '<div class="card"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px"><div><strong>' + esc(a.titulo) + '</strong> <span class="pill">' + esc(a.frequencia) + '</span>' + (a.ativa ? "" : ' <span class="pill">pausada</span>') +
          '<p class="muted" style="margin:4px 0 0;white-space:pre-wrap">' + esc(a.descricao) + '</p></div>' +
          '<div><button class="btn btn-texto" data-acao="alternar" data-id="' + a.id + '" data-ativa="' + a.ativa + '">' + (a.ativa ? "Pausar" : "Reativar") + '</button><button class="btn btn-texto" data-acao="apagar" data-tabela="atividades" data-id="' + a.id + '">Excluir</button></div></div>' +
          '<p class="eyebrow" style="margin:12px 0 6px">Registros dela (' + meus.length + ')</p>' +
          (meus.length ? meus.slice(0, 10).map(function (g) { return '<div class="leitura" style="margin-top:6px"><strong>' + dataBR(g.dia) + '</strong> ' + (g.feito ? "✓ feito" : "não feito") + (g.texto ? "\n" + esc(g.texto) : "") + '</div>'; }).join("") : '<p class="muted">Nenhum registro ainda.</p>') + '</div>';
      }).join("") : '<p class="muted">Nenhuma atividade criada.</p>') + '</div>' +
        '<form data-form="nova-atividade" class="card pilha" style="margin-top:16px" novalidate><p class="eyebrow">Nova atividade</p><div class="grid2">' +
        '<label>Título<input name="titulo" required></label><label>Frequência<select name="frequencia"><option value="diaria">diária</option><option value="semanal">semanal</option><option value="unica">única</option></select></label></div>' +
        '<label>Como fazer<textarea name="descricao"></textarea></label><p class="erro" role="alert"></p><button class="btn btn-linha btn-pq" type="submit">Criar atividade</button></form>';
    } else {
      var rt = await sb.from("avaliacoes").select("*").eq("mentoria_id", m.id).order("criado_em");
      var ts = rt.data || [];
      alvo.innerHTML = '<div class="pilha">' + (ts.length ? ts.map(function (t) {
        return '<form data-form="devolutiva" data-id="' + t.id + '" class="card pilha" novalidate><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><strong>' + esc(t.nome) + '</strong><button type="button" class="btn btn-texto" data-acao="apagar" data-tabela="avaliacoes" data-id="' + t.id + '">Excluir</button></div>' +
          (t.instrucoes ? '<p class="muted" style="margin:0;white-space:pre-wrap">' + esc(t.instrucoes) + '</p>' : "") + (t.link ? '<a href="' + esc(t.link) + '" target="_blank" rel="noopener">Abrir link do teste</a>' : "") +
          '<div><p class="eyebrow" style="margin-bottom:6px">Resposta dela</p><div class="leitura">' + (esc(t.resposta_mentorada) || '<span class="muted">Ainda sem resposta.</span>') + '</div></div>' +
          '<label>Sua devolutiva<textarea name="devolutiva_mentora">' + esc(t.devolutiva_mentora) + '</textarea></label><p class="erro" role="alert"></p><button class="btn btn-escuro btn-pq" type="submit">Salvar devolutiva</button></form>';
      }).join("") : '<p class="muted">Nenhum teste ou ferramenta liberado.</p>') + '</div>' +
        '<form data-form="novo-teste" class="card pilha" style="margin-top:16px" novalidate><p class="eyebrow">Liberar teste ou ferramenta</p><div class="grid2">' +
        '<label>Nome<input name="nome" required placeholder="Ex.: Teste de Temperamento"></label><label>Link (opcional)<input name="link" type="url"></label></div>' +
        '<label>Instruções<textarea name="instrucoes"></textarea></label><p class="erro" role="alert"></p><button class="btn btn-linha btn-pq" type="submit">Liberar</button></form>';
    }
  }

  /* ---------- área da mentorada ---------- */
  async function areaMentorada() {
    await carregaMentorias(true);
    var m = atual();
    var nome = (S.perfil.nome || "").split(" ")[0];
    if (!m) {
      pinta('<div class="centro"><div class="card login" style="text-align:center"><h1 style="font-size:22px">Olá' + (nome ? ", " + esc(nome) : "") + '!</h1><p class="muted">A sua mentoria ainda está sendo preparada. Em breve tudo aparece aqui.</p></div></div>');
      return;
    }
    var res = await Promise.all([
      sb.from("encontros").select("*").eq("mentoria_id", m.id).order("numero").order("data"),
      sb.from("checkins").select("*").eq("mentoria_id", m.id).order("dia", { ascending: false }).limit(14),
      sb.from("atividades").select("*").eq("mentoria_id", m.id).eq("ativa", true).order("criado_em"),
      sb.from("avaliacoes").select("*").eq("mentoria_id", m.id).order("criado_em")
    ]);
    var encs = res[0].data || [], cks = res[1].data || [], ats = res[2].data || [], ts = res[3].data || [];
    var regs = [];
    if (ats.length) {
      var rr = await sb.from("registros").select("*").in("atividade_id", ats.map(function (a) { return a.id; })).order("dia", { ascending: false }).limit(100);
      regs = rr.data || [];
    }
    var h = hoje();
    var ckHoje = cks.find(function (c) { return c.dia === h; }) || {};
    var contaveis = encs.filter(function (e) { return e.tipo !== "extra"; });
    var feitos = contaveis.filter(function (e) { return e.status === "realizado"; }).length;
    var pct = contaveis.length ? Math.round(feitos / contaveis.length * 100) : 0;

    var html = '<div class="leitor">' +
      '<div class="hero"><span class="eyebrow">' + esc(m.programa) + (m.inicio ? " · início em " + dataBR(m.inicio) : "") + '</span>' +
      '<h1>' + esc(m.programa) + '</h1>' +
      '<p class="muted" style="text-align:left">Olá, ' + esc(nome) + '! Esta é a sua área. Tudo da sua mentoria fica aqui.</p>' +
      (m.descricao ? '<p>' + esc(m.descricao) + '</p>' : "") +
      ((m.formato || []).length ? '<div class="formato">' + m.formato.map(function (f) { return '<div><span>' + esc(f[0]) + '</span><strong>' + esc(f[1]) + '</strong></div>'; }).join("") + '</div>' : "") +
      (S.lista.length > 1 ? '<label style="max-width:320px">Mentoria<select data-acao="trocar">' + S.lista.map(function (x) { return '<option value="' + x.id + '"' + (x.id === S.selId ? " selected" : "") + '>' + esc(x.programa) + '</option>'; }).join("") + '</select></label>' : "") +
      '</div>';

    html += '<section class="secao"><h2>Acompanhamento diário</h2><p class="muted" style="margin:0">Todos os dias, no fim do dia, um check-in rápido: o que você fez, o que adiou e qual será a sua ação de amanhã. É ele que transforma intenção em compromisso.</p>' +
      '<form data-form="checkin" class="card pilha" novalidate><div class="grid2"><label>Dia<input type="date" name="dia" value="' + h + '" max="' + h + '"></label></div>' +
      '<label>O que eu fiz hoje<textarea name="fiz" rows="2">' + esc(ckHoje.fiz) + '</textarea></label>' +
      '<label>O que eu adiei<textarea name="adiei" rows="2">' + esc(ckHoje.adiei) + '</textarea></label>' +
      '<label>Minha ação de amanhã<textarea name="acao_amanha" rows="2">' + esc(ckHoje.acao_amanha) + '</textarea></label>' +
      '<p class="erro" role="alert"></p><button class="btn btn-cobre btn-pq" type="submit" style="align-self:flex-start">Salvar check-in</button></form>' +
      (cks.length ? '<details class="encontro"><summary><strong>Meus últimos check-ins (' + cks.length + ')</strong></summary><div class="pilha" style="margin-top:12px">' + cks.map(function (c) {
        return '<div class="leitura"><strong>' + diaCurto(c.dia) + '</strong>' + (c.fiz ? "\nFiz: " + esc(c.fiz) : "") + (c.adiei ? "\nAdiei: " + esc(c.adiei) : "") + (c.acao_amanha ? "\nAmanhã: " + esc(c.acao_amanha) : "") + (c.comentario_mentora ? "\n\nComentário da mentora: " + esc(c.comentario_mentora) : "") + '</div>';
      }).join("") + '</div></details>' : "") + '</section>';

    if ((m.fases || []).length) {
      html += '<section class="secao"><h2>A trilha</h2><ol class="fases">' + m.fases.map(function (f, i) {
        return '<li><b>' + (i + 1) + '</b><div><strong>' + esc(f[0]) + '</strong><small>' + esc(f[1] || "") + '</small></div></li>';
      }).join("") + '</ol></section>';
    }

    html += '<section class="secao"><h2>Seus encontros</h2>' +
      '<div class="barra"><span>Andamento</span><div><i style="width:' + pct + '%"></i></div><b>' + feitos + ' de ' + contaveis.length + ' realizados</b></div>' +
      '<div class="pilha">' + encs.map(function (e) {
        var aberto = e.liberado || e.status === "realizado";
        return '<details class="encontro' + (e.status === "realizado" ? " feito" : "") + '"><summary><span class="hex num">' + hexNum(e) + '</span><span style="flex:1 1 200px"><span class="fase-tag">' + esc(e.fase) + (e.semana ? " · " + esc(e.semana) : "") + '</span><br><strong>' + esc(e.titulo) + '</strong><br><span class="muted">' + (e.tipo === "extra" && !e.data ? "Quando você precisar" : dataBR(e.data, true)) + '</span></span><span class="pill' + (e.status === "realizado" ? " feito" : "") + '">' + (e.status === "realizado" ? "Realizado" : e.status === "agendado" ? (e.data ? "Agendado" : "A agendar") : esc(e.status)) + '</span></summary>' +
          '<div class="pilha" style="margin-top:14px">' + (aberto ?
            (e.objetivo ? '<p style="margin:0;text-align:justify">' + esc(e.objetivo) + '</p>' : "") +
            '<dl class="campos">' + (e.ferramenta ? '<div><dt>Ferramenta</dt><dd>' + esc(e.ferramenta) + '</dd></div>' : "") + (e.versiculo ? '<div><dt>Palavra</dt><dd>' + esc(e.versiculo) + '</dd></div>' : "") + '</dl>' +
            (e.tarefa ? '<dl class="campos executar"><div><dt>Hora de executar</dt><dd>' + esc(e.tarefa) + '</dd></div></dl>' : "") +
            (e.anotacoes_mentora ? '<div><p class="eyebrow" style="margin-bottom:6px">Registro do encontro</p><div class="leitura">' + esc(e.anotacoes_mentora) + '</div></div>' : "") +
            '<form data-form="reflexao" data-id="' + e.id + '" class="pilha" novalidate><label>Minha reflexão sobre este encontro<textarea name="texto">' + esc(e.reflexao_mentorada) + '</textarea></label><p class="erro" role="alert"></p><button class="btn btn-escuro btn-pq" type="submit" style="align-self:flex-start">Salvar reflexão</button></form>'
            : '<p class="bloqueado">O conteúdo deste encontro é liberado pela sua mentora no dia do encontro.</p>') +
          '</div></details>';
      }).join("") + '</div></section>';

    if (ats.length) {
      html += '<section class="secao"><h2>Atividades</h2><div class="pilha">' + ats.map(function (a) {
        var meus = regs.filter(function (g) { return g.atividade_id === a.id; });
        var hj = meus.find(function (g) { return g.dia === h; });
        return '<form data-form="registro" data-id="' + a.id + '" class="card pilha" novalidate><div><strong>' + esc(a.titulo) + '</strong> <span class="pill">' + esc(a.frequencia) + '</span><p class="muted" style="margin:4px 0 0;white-space:pre-wrap">' + esc(a.descricao) + '</p></div>' +
          '<div class="hoje"><label style="flex-direction:row;align-items:center;gap:8px;font-size:15px"><input type="checkbox" name="feito" style="width:22px;min-height:22px"' + (hj && hj.feito ? " checked" : "") + '> Fiz hoje</label><label style="flex:1 1 160px">Dia<input type="date" name="dia" value="' + h + '" max="' + h + '"></label></div>' +
          '<label>Como foi? (opcional)<textarea name="texto">' + esc(hj ? hj.texto : "") + '</textarea></label><p class="erro" role="alert"></p><button class="btn btn-escuro btn-pq" type="submit" style="align-self:flex-start">Salvar registro</button></form>';
      }).join("") + '</div></section>';
    }

    if (ts.length) {
      html += '<section class="secao"><h2>Testes e ferramentas</h2><div class="pilha">' + ts.map(function (t) {
        return '<form data-form="resposta" data-id="' + t.id + '" class="card pilha" novalidate><strong>' + esc(t.nome) + '</strong>' +
          (t.instrucoes ? '<p class="muted" style="margin:0;white-space:pre-wrap">' + esc(t.instrucoes) + '</p>' : "") + (t.link ? '<a href="' + esc(t.link) + '" target="_blank" rel="noopener">Abrir o teste</a>' : "") +
          '<label>Meu resultado ou resposta<textarea name="texto">' + esc(t.resposta_mentorada) + '</textarea></label><p class="erro" role="alert"></p><button class="btn btn-escuro btn-pq" type="submit" style="align-self:flex-start">Salvar</button>' +
          (t.devolutiva_mentora ? '<div><p class="eyebrow" style="margin-bottom:6px">Devolutiva da mentora</p><div class="leitura">' + esc(t.devolutiva_mentora) + '</div></div>' : "") + '</form>';
      }).join("") + '</div></section>';
    }

    if ((m.entregas || []).length) html += '<section class="secao"><h2>O que você leva</h2><ul class="lista-hex">' + m.entregas.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></section>';
    if ((m.combinados || []).length) html += '<section class="secao"><div class="card"><h2 style="font-size:20px">Nossos combinados</h2><ul style="margin:10px 0 0;padding-left:20px;display:grid;gap:4px">' + m.combinados.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div></section>';

    pinta(html + '</div>');
  }

  function recarrega() { return S.perfil && S.perfil.papel === "mentora" ? painelMentora() : areaMentorada(); }

  /* ---------- eventos ---------- */
  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-acao]");
    if (!b || b.tagName === "SELECT") return;
    var a = b.getAttribute("data-acao");
    if (a === "sair") { await sb.auth.signOut(); S = { sessao: null, perfil: null, lista: [], selId: null, aba: "plano", novo: false, msg: "", modelos: [] }; return telaLogin(); }
    if (a === "ir-esqueci") return telaLogin("esqueci");
    if (a === "ir-login") return telaLogin();
    if (a === "aba") { S.aba = b.getAttribute("data-aba"); return recarrega(); }
    if (a === "novo") { S.novo = true; return painelMentora(); }
    if (a === "sel") { S.novo = false; S.selId = b.getAttribute("data-id"); S.aba = "plano"; return painelMentora(); }
    if (a === "apagar") {
      if (!window.confirm("Excluir este item? Isso não pode ser desfeito.")) return;
      await sb.from(b.getAttribute("data-tabela")).delete().eq("id", b.getAttribute("data-id"));
      return recarrega();
    }
    if (a === "alternar") {
      await sb.from("atividades").update({ ativa: b.getAttribute("data-ativa") !== "true" }).eq("id", b.getAttribute("data-id"));
      return recarrega();
    }
  });
  document.addEventListener("change", function (ev) {
    if (ev.target.matches("[data-acao=trocar]")) { S.selId = ev.target.value; areaMentorada(); }
  });

  document.addEventListener("submit", async function (ev) {
    var f = ev.target.closest("form[data-form]");
    if (!f) return;
    ev.preventDefault();
    var t = f.getAttribute("data-form"), d = fd(f), id = f.getAttribute("data-id"), r;
    aviso(f, ""); ocupado(f, true);
    try {
      if (t === "login") {
        if (!d.email || !d.senha) throw { message: "Preencha e-mail e senha." };
        r = await sb.auth.signInWithPassword({ email: d.email, password: d.senha });
        if (r.error) throw r.error;
        return rota();
      }
      if (t === "esqueci") {
        if (!d.email) throw { message: "Informe o seu e-mail." };
        r = await sb.auth.resetPasswordForEmail(d.email, { redirectTo: urlRetorno() });
        if (r.error) throw r.error;
        aviso(f, "Se o e-mail estiver cadastrado, você vai receber um link em instantes.", true); return;
      }
      if (t === "senha") {
        if ((d.senha || "").length < 8) throw { message: "A senha precisa ter pelo menos 8 caracteres." };
        if (d.senha !== d.senha2) throw { message: "As duas senhas não são iguais." };
        r = await sb.auth.updateUser({ password: d.senha });
        if (r.error) throw r.error;
        hashTipo = null; history.replaceState(null, "", location.pathname);
        return rota();
      }
      if (t === "nova") {
        if (!d.nome || !d.email) throw { message: "Preencha nome e e-mail." };
        r = await sb.functions.invoke("convidar", { body: { nome: d.nome, email: d.email, programa: d.programa, inicio: d.inicio || null, redirectTo: urlRetorno() } });
        if (r.error) { var det = r.error.context && r.error.context.json ? await r.error.context.json().catch(function () { return null; }) : null; throw { message: (det && det.erro) || r.error.message }; }
        if (r.data && r.data.erro) throw { message: r.data.erro };
        if (d.modelo) await sb.rpc("aplicar_modelo", { p_mentoria: r.data.mentoria_id, p_modelo: d.modelo });
        else if (d.programa === "Jornada Lapidar") await sb.rpc("criar_encontros_lapidar", { p_mentoria: r.data.mentoria_id });
        S.novo = false; S.selId = r.data.mentoria_id; S.aba = "plano";
        S.msg = r.data.convidada ? "Convite enviado para " + d.email + ". Ela vai receber um e-mail para criar a senha." : "Ela já tinha cadastro: a nova mentoria foi adicionada à área dela.";
        return painelMentora();
      }
      if (t === "plano") {
        r = await sb.from("mentorias").update({ programa: d.programa, status: d.status, inicio: d.inicio || null, fim: d.fim || null, descricao: d.descricao, proposta: d.proposta, objetivos: d.objetivos, investimento: d.investimento, formato: deLinhas(d.formato, true), fases: deLinhas(d.fases, true), entregas: deLinhas(d.entregas), combinados: deLinhas(d.combinados) }).eq("id", S.selId);
        if (r.error) throw r.error; S.msg = "Plano salvo."; return painelMentora();
      }
      if (t === "aplicar-modelo") {
        if (!d.modelo) throw { message: "Escolha um modelo." };
        if (!window.confirm("Substituir todos os encontros desta mentorada pelos do modelo?")) return;
        r = await sb.rpc("aplicar_modelo", { p_mentoria: S.selId, p_modelo: d.modelo });
        if (r.error) throw r.error; S.msg = "Modelo aplicado."; return painelMentora();
      }
      if (t === "encontro") {
        r = await sb.from("encontros").update({ titulo: d.titulo, data: deInput(d.data), status: d.status, fase: d.fase, semana: d.semana, tema: d.tema, objetivo: d.objetivo, ferramenta: d.ferramenta, versiculo: d.versiculo, tarefa: d.tarefa, anotacoes_mentora: d.anotacoes_mentora, liberado: !!f.querySelector("[name=liberado]").checked }).eq("id", id);
        if (r.error) throw r.error; aviso(f, "Encontro salvo.", true); return;
      }
      if (t === "novo-encontro") {
        if (!d.titulo) throw { message: "Dê um título ao encontro." };
        var max = await sb.from("encontros").select("numero").eq("mentoria_id", S.selId).order("numero", { ascending: false }).limit(1);
        var n = max.data && max.data.length ? max.data[0].numero + 1 : 1;
        r = await sb.from("encontros").insert({ mentoria_id: S.selId, titulo: d.titulo, data: deInput(d.data), numero: n });
        if (r.error) throw r.error; return painelMentora();
      }
      if (t === "comentario") {
        r = await sb.from("checkins").update({ comentario_mentora: d.comentario_mentora }).eq("id", id);
        if (r.error) throw r.error; aviso(f, "Comentário salvo.", true); return;
      }
      if (t === "nova-atividade") {
        if (!d.titulo) throw { message: "Dê um título à atividade." };
        r = await sb.from("atividades").insert({ mentoria_id: S.selId, titulo: d.titulo, descricao: d.descricao, frequencia: d.frequencia });
        if (r.error) throw r.error; return painelMentora();
      }
      if (t === "novo-teste") {
        if (!d.nome) throw { message: "Dê um nome ao teste." };
        r = await sb.from("avaliacoes").insert({ mentoria_id: S.selId, nome: d.nome, link: d.link, instrucoes: d.instrucoes });
        if (r.error) throw r.error; return painelMentora();
      }
      if (t === "devolutiva") {
        r = await sb.from("avaliacoes").update({ devolutiva_mentora: d.devolutiva_mentora }).eq("id", id);
        if (r.error) throw r.error; aviso(f, "Devolutiva salva.", true); return;
      }
      if (t === "checkin") {
        if (!d.fiz && !d.adiei && !d.acao_amanha) throw { message: "Escreva pelo menos uma das três respostas." };
        r = await sb.from("checkins").upsert({ mentoria_id: S.selId, mentorada_id: S.sessao.user.id, dia: d.dia || hoje(), fiz: d.fiz, adiei: d.adiei, acao_amanha: d.acao_amanha }, { onConflict: "mentoria_id,dia" });
        if (r.error) throw r.error; aviso(f, "Check-in salvo. Até amanhã!", true); return;
      }
      if (t === "reflexao") {
        r = await sb.rpc("salvar_reflexao", { p_encontro: id, p_texto: d.texto });
        if (r.error) throw r.error; aviso(f, "Reflexão salva.", true); return;
      }
      if (t === "resposta") {
        r = await sb.rpc("salvar_resposta", { p_avaliacao: id, p_texto: d.texto });
        if (r.error) throw r.error; aviso(f, "Resposta salva.", true); return;
      }
      if (t === "registro") {
        r = await sb.from("registros").upsert({ atividade_id: id, mentorada_id: S.sessao.user.id, dia: d.dia || hoje(), feito: !!f.querySelector("[name=feito]").checked, texto: d.texto }, { onConflict: "atividade_id,dia" });
        if (r.error) throw r.error; aviso(f, "Registro salvo.", true); return;
      }
    } catch (e) {
      aviso(f, traduz(e));
    } finally {
      if (document.body.contains(f)) ocupado(f, false);
    }
  });

  /* ---------- início ---------- */
  sb.auth.onAuthStateChange(function (evento) {
    if (evento === "PASSWORD_RECOVERY") { hashTipo = "recovery"; setTimeout(telaSenha, 0); }
  });
  (async function () {
    if (C.SUPABASE_URL.indexOf("COLE_AQUI") === 0) { pinta('<div class="centro"><p class="muted">Falta configurar o arquivo config.js.</p></div>'); return; }
    var r = await sb.auth.getSession();
    if (r.data.session && (hashTipo === "invite" || hashTipo === "recovery")) { S.sessao = r.data.session; return telaSenha(); }
    rota();
  })();
})();
