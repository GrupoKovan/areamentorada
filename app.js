/* Área da mentorada · Grupo Kovan
   Mesma página para as duas: a mentorada vê e faz o check-in;
   a mentora vê a mesma página com os controles de edição. */
(function () {
  var CFG = window.KOVAN_CONFIG;
  var app = document.getElementById("app");
  var topo = document.getElementById("topo-acoes");
  var hashTipo = new URLSearchParams(location.hash.slice(1)).get("type");
  var sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
    auth: { detectSessionInUrl: true, persistSession: true, flowType: "implicit" }
  });

  var PROGRAMAS = ["Jornada Lapidar", "Mentoria Posicionadas", "Jornada da Liderança", "Plano de Voo", "Mentoria de Negócios", "Mentoria profissional", "Outra"];
  var FIELDS = [["tratado", "O que foi tratado"], ["identificacoes", "Identificações relevantes"], ["atencao", "Pontos de atenção"], ["avancos", "Avanços percebidos"], ["tarefas_semana", "Tarefas para esta semana"]];
  var ITEMS = [["acao_feita", "Ação de empresária"], ["deus", "Tempo com Deus"], ["agenda", "Agenda do dia"], ["divulgacao", "Divulgação"], ["autocuidado", "Autocuidado"], ["casa", "Casa"]];
  var DOW = ["D", "S", "T", "Q", "Q", "S", "S"];
  var DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  var S;
  function reset() {
    S = { sessao: null, perfil: null, owner: false, lista: [], selId: null, novo: false, modelos: [],
      M: null, E: [], C: {}, A: {}, view: "panel", formDay: null, selDay: null,
      abertos: {}, editing: null, lockEdit: null, drafts: {}, saving: false };
  }
  reset();

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function add(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function today() { return iso(new Date()); }
  function br(s) { var p = s.split("-"); return p[2] + "/" + p[1]; }
  function dataBR(ts) { if (!ts) return ""; var d = new Date(ts.length === 10 ? ts + "T12:00:00" : ts); return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear(); }
  function horaBR(ts) { if (!ts) return ""; var d = new Date(ts); return pad(d.getHours()) + "h" + (d.getMinutes() ? pad(d.getMinutes()) : ""); }
  function diaDe(ts) { return ts ? iso(new Date(ts)) : null; }
  function paraInput(ts) { if (!ts) return ""; var d = new Date(ts); return iso(d) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function deInput(v) { return v ? new Date(v).toISOString() : null; }
  function primeiroNome() { var n = S.M && S.M.mentorada ? (S.M.mentorada.nome || "") : ""; return n.split(" ")[0] || "ela"; }
  function multi(t) { return esc(t).replace(/\n/g, "<br>"); }
  var toastT;
  function toast(m) { var t = document.getElementById("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3800); }
  function traduz(e) {
    var m = (e && (e.message || e.erro)) || String(e || "");
    if (/Invalid login credentials/i.test(m)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(m)) return "Confirme o seu e-mail pelo convite recebido.";
    if (/Password should be at least/i.test(m)) return "A senha precisa ter pelo menos 8 caracteres.";
    if (/rate limit/i.test(m)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    if (/already been registered/i.test(m)) return "Este e-mail já tem cadastro.";
    if (/row-level security/i.test(m)) return "Sem permissão para salvar isso.";
    return m || "Algo deu errado. Tente novamente.";
  }
  function fd(form) { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = typeof v === "string" ? v.trim() : v; }); return o; }
  function erroForm(form, texto, ok) { var p = form.querySelector(".erro,.okmsg"); if (p) { p.textContent = texto; p.className = ok ? "okmsg" : "erro"; } }
  function linhas(arr) { return (arr || []).map(function (x) { return Array.isArray(x) ? x.join(" | ") : x; }).join("\n"); }
  function deLinhas(txt, pares) { return (txt || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { if (!pares) return l; var p = l.split("|"); return [p[0].trim(), (p.slice(1).join("|") || "").trim()]; }); }
  function opts(lista, atual) { return lista.map(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (String(v) === String(atual) ? " selected" : "") + '>' + esc(t) + '</option>'; }).join(""); }
  function field(label, ctl) { return '<div class="field"><label>' + label + '</label>' + ctl + '</div>'; }
  function hexNum(e) { return e.tipo === "diagnostico" ? "D" : e.tipo === "extra" ? "+" : pad(e.numero); }

  /* ---------- topo ---------- */
  function pintaTopo() {
    if (!S.sessao) { topo.innerHTML = '<a class="ghost pq" href="https://wa.me/' + CFG.WHATSAPP + '" style="text-decoration:none">Fale conosco</a>'; return; }
    var h = "";
    if (S.owner) {
      if (S.lista.length) h += '<select data-acao="trocar" aria-label="Mentorada">' + S.lista.map(function (x) {
        var n = x.mentorada ? (x.mentorada.nome || x.mentorada.email) : "";
        return '<option value="' + x.id + '"' + (!S.novo && x.id === S.selId ? " selected" : "") + '>' + esc(n) + " · " + esc(x.programa) + '</option>';
      }).join("") + '</select>';
      h += '<button class="btn pq" data-acao="novo">+ Nova mentorada</button>';
    } else {
      h += '<span class="quem">' + esc(((S.perfil && S.perfil.nome) || S.sessao.user.email).split(" ")[0]) + '</span>';
    }
    h += '<button class="ghost pq" data-acao="sair">Sair</button>';
    topo.innerHTML = h;
  }

  /* ---------- entrada ---------- */
  function telaLogin(modo) {
    S.sessao = null; pintaTopo();
    var esq = modo === "esqueci";
    app.innerHTML = '<div class="centro"><div class="cartao">' +
      '<div class="hex"></div>' +
      '<h1 style="text-align:center">' + (esq ? "Recuperar senha" : "Área da mentorada") + '</h1>' +
      '<p class="ci-note" style="text-align:center">' + (esq ? "Informe o seu e-mail e enviaremos um link para criar uma nova senha." : "Entre com o seu e-mail e a sua senha.") + '</p>' +
      '<form data-form="' + (esq ? "esqueci" : "login") + '" style="display:grid;gap:12px" novalidate>' +
      field("E-mail", '<input name="email" type="email" autocomplete="email" required>') +
      (esq ? "" : field("Senha", '<input name="senha" type="password" autocomplete="current-password" required>')) +
      '<p class="erro" role="alert"></p><button class="btn full" type="submit">' + (esq ? "Enviar link" : "Entrar") + '</button></form>' +
      '<p style="text-align:center;margin:0"><button class="linkbtn" data-acao="' + (esq ? "ir-login" : "ir-esqueci") + '">' + (esq ? "← Voltar para o login" : "Esqueci a minha senha") + '</button></p>' +
      '</div></div>';
  }
  function telaSenha() {
    pintaTopo();
    var conv = hashTipo === "invite";
    app.innerHTML = '<div class="centro"><div class="cartao">' +
      '<span class="eyebrow" style="text-align:center">' + (conv ? "Boas-vindas" : "Nova senha") + '</span>' +
      '<h1 style="text-align:center">' + (conv ? "Crie a sua senha de acesso" : "Defina a sua nova senha") + '</h1>' +
      '<p class="ci-note" style="text-align:center">Use pelo menos 8 caracteres. Você vai usar esta senha sempre que entrar na sua área.</p>' +
      '<form data-form="senha" style="display:grid;gap:12px" novalidate>' +
      field("Nova senha", '<input name="senha" type="password" autocomplete="new-password" minlength="8" required>') +
      field("Repita a senha", '<input name="senha2" type="password" autocomplete="new-password" minlength="8" required>') +
      '<p class="erro" role="alert"></p><button class="btn full" type="submit">Salvar senha e entrar</button></form></div></div>';
  }

  async function rota() {
    var r = await sb.auth.getSession();
    S.sessao = r.data.session;
    if (!S.sessao) return telaLogin();
    var p = await sb.from("perfis").select("*").eq("id", S.sessao.user.id).single();
    S.perfil = p.data || { nome: "", papel: "mentorada" };
    S.owner = S.perfil.papel === "mentora";
    if (S.owner) { var rm = await sb.from("modelos").select("id,nome").order("nome"); S.modelos = rm.data || []; }
    await carregaLista();
    await carregaMentoria();
  }

  async function carregaLista() {
    var q = sb.from("mentorias").select("*, mentorada:perfis(id,nome,email)").order("criado_em", { ascending: false });
    if (!S.owner) q = q.eq("mentorada_id", S.sessao.user.id);
    var r = await q;
    S.lista = r.data || [];
    if (!S.selId || !S.lista.some(function (m) { return m.id === S.selId; })) S.selId = S.lista.length ? S.lista[0].id : null;
  }

  async function carregaMentoria() {
    pintaTopo();
    if (S.owner && (S.novo || !S.selId)) return telaNova();
    S.M = S.lista.find(function (m) { return m.id === S.selId; }) || null;
    if (!S.M) {
      app.innerHTML = '<div class="centro"><div class="cartao" style="text-align:center"><h1 style="font-size:22px">Olá!</h1><p class="ci-note">A sua mentoria ainda está sendo preparada. Em breve tudo aparece aqui.</p></div></div>';
      return;
    }
    var res = await Promise.all([
      sb.from("encontros").select("*").eq("mentoria_id", S.M.id).order("numero").order("data"),
      sb.from("checkins").select("*").eq("mentoria_id", S.M.id).order("dia"),
      sb.from("acoes").select("*").eq("mentoria_id", S.M.id)
    ]);
    S.E = res[0].data || [];
    S.C = {}; (res[1].data || []).forEach(function (c) { S.C[c.dia] = c; });
    S.A = {}; (res[2].data || []).forEach(function (a) { S.A[a.dia] = a; });
    render();
  }

  /* ---------- nova mentorada (mentora) ---------- */
  function telaNova() {
    app.innerHTML = '<div class="wrap"><div class="cartao largo">' +
      '<span class="eyebrow">Nova mentorada</span><h1>Convidar para a plataforma</h1>' +
      '<p class="ci-note">Ela recebe um e-mail para criar a senha e acessar a área dela.</p>' +
      '<form data-form="nova" style="display:grid;gap:12px" novalidate><div class="row">' +
      field("Nome completo", '<input name="nome" required>') + field("E-mail", '<input name="email" type="email" required>') +
      field("Programa", '<select name="programa">' + opts(PROGRAMAS, "Jornada Lapidar") + '</select>') + field("Data de início", '<input name="inicio" type="date">') + '</div>' +
      field("Roteiro (modelo)", '<select name="modelo"><option value="">Sem modelo (em branco)</option>' + opts(S.modelos.map(function (m) { return [m.id, m.nome]; }), "") + '</select>') +
      '<p class="hint">O modelo preenche os encontros, a trilha, as entregas e os combinados. Depois você ajusta tudo do jeito dela.</p>' +
      '<p class="erro" role="alert"></p><div class="btns"><button class="btn" type="submit">Enviar convite</button>' +
      (S.lista.length ? '<button class="ghost" type="button" data-acao="cancelar-novo">Cancelar</button>' : "") + '</div></form></div></div>';
  }

  /* ---------- check-in: cálculos ---------- */
  function done(c, k) { if (!c) return 0; if (k === "agenda") return c.agenda === "sim" ? 1 : c.agenda === "parcial" ? 0.5 : 0; return c[k] === true ? 1 : 0; }
  function score(c) { var s = 0; ITEMS.forEach(function (it) { s += done(c, it[0]); }); return s / ITEMS.length; }
  function level(c) { if (!c) return "miss"; var s = score(c); return s >= 0.8 ? "l3" : s >= 0.5 ? "l2" : "l1"; }
  function firstDay() { var ks = Object.keys(S.C).sort(); var f = (S.M && S.M.inicio) || ks[0] || today(); if (ks[0] && ks[0] < f) f = ks[0]; return f; }
  function daysRange() { var out = [], d = firstDay(), t = today(); if (d > t) return out; while (d <= t) { out.push(d); d = add(d, 1); } return out; }
  function streak() { var d = today(); if (!S.C[d]) d = add(d, -1); var n = 0; while (S.C[d]) { n++; d = add(d, -1); } return n; }
  function last7() { var out = []; for (var i = 0; i < 7; i++) out.push(add(today(), -i)); return out; }
  function themeFor(d) { var cur = null; S.E.filter(function (e) { return e.data && e.tipo !== "extra"; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; }).forEach(function (e) { if (diaDe(e.data) <= d) cur = e; }); return cur; }

  function tiles() {
    var days = daysRange(), filled = days.filter(function (d) { return S.C[d]; }).length;
    var l7 = last7().filter(function (d) { return S.C[d]; });
    var notas = l7.map(function (d) { return S.C[d].nota; }).filter(function (n) { return n != null; });
    var media = notas.length ? notas.reduce(function (a, b) { return a + b; }, 0) / notas.length : null;
    var atend = l7.reduce(function (a, d) { return a + (+S.C[d].atendimentos || 0); }, 0);
    function t(l, v, s) { return '<div class="tile"><span>' + l + '</span><b>' + v + '</b><small>' + s + '</small></div>'; }
    return '<div class="tiles">' + t("Check-ins", filled + " de " + days.length, "dias desde o início") + t("Sequência", streak(), "dias seguidos") +
      t("Compromisso", media == null ? "–" : media.toFixed(1).replace(".", ","), "nota média, 7 dias") + t("Atendimentos", atend, "últimos 7 dias") + '</div>';
  }

  function calendar() {
    var days = daysRange();
    if (!days.length) return '<div class="mini"><p class="ci-note">O calendário começa a aparecer a partir do início da mentoria.</p></div>';
    var g = '<div class="cal" role="grid" aria-label="Calendário de check-ins">' + DOW.map(function (x) { return '<div class="dow">' + x + '</div>'; }).join("");
    var first = parse(days[0]); for (var i = 0; i < first.getDay(); i++) g += '<button class="pre" type="button" tabindex="-1" aria-hidden="true"></button>';
    days.forEach(function (d) {
      var c = S.C[d], isT = d === today(), lv = (!c && isT) ? "" : level(c);
      g += '<button type="button" class="' + lv + '" data-acao="dia" data-d="' + d + '" aria-pressed="' + (S.selDay === d) + '" aria-label="' + br(d) + (c ? " – check-in feito" : " – sem check-in") + '">' + parse(d).getDate() + '</button>';
    });
    g += '</div>';
    var h = '<div class="mini"><div class="cal-wrap">' + g + '</div>' +
      '<div class="legend"><span><i style="border-style:dashed"></i>Sem check-in</span><span><i style="background:color-mix(in srgb,var(--ok) 35%,var(--surface));border-color:transparent"></i>Menos da metade</span><span><i style="background:color-mix(in srgb,var(--ok) 65%,var(--surface));border-color:transparent"></i>Metade ou mais</span><span><i style="background:var(--ok);border-color:transparent"></i>80% ou mais</span></div>';
    if (S.selDay) {
      var c = S.C[S.selDay];
      h += '<div class="daydetail"><strong>Dia ' + br(S.selDay) + '</strong>';
      if (!c) h += '<p class="ci-note">Sem check-in neste dia.</p>';
      else {
        var lab = { sim: "Sim", parcial: "Em parte", nao: "Não" };
        var yn = function (v) { return v === true ? "Sim" : v === false ? "Não" : "–"; };
        var row = function (k, v) { return '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>'; };
        if (c.acao_do_dia) h += '<p class="ci-note">Ação do dia: ' + esc(c.acao_do_dia) + '</p>';
        h += '<dl>' + row(c.acao_do_dia ? "Fez a ação do dia" : "Ação de empresária", yn(c.acao_feita) + (c.acao ? " · " + c.acao : "")) + row("Tempo com Deus", yn(c.deus)) + row("Agenda", lab[c.agenda] || "–") +
          row("Divulgação", yn(c.divulgacao)) + row("Autocuidado", yn(c.autocuidado)) + row("Casa", yn(c.casa)) + row("Atendimentos", c.atendimentos == null ? "–" : String(c.atendimentos)) + row("Compromisso", c.nota == null ? "–" : c.nota + "/10") + '</dl>';
        if (c.adiei) h += '<p class="ci-note">Adiei: ' + esc(c.adiei) + '</p>';
        if (c.acao_amanha) h += '<p class="ci-note">Ação para o dia seguinte: ' + esc(c.acao_amanha) + '</p>';
        if (S.owner) h += '<form data-form="comentario" data-id="' + c.id + '" style="display:grid;gap:8px;margin-top:8px">' + field("Seu comentário (ela vê)", '<textarea name="comentario_mentora" rows="2">' + esc(c.comentario_mentora) + '</textarea>') + '<div class="btns"><button class="ghost pq" type="submit">Salvar comentário</button></div></form>';
        else if (c.comentario_mentora) h += '<p class="comentario"><b>Da sua mentora</b>' + multi(c.comentario_mentora) + '</p>';
      }
      h += '</div>';
    }
    return h + '</div>';
  }

  function bars() {
    var l7 = last7().filter(function (d) { return d >= firstDay() && d <= today(); });
    var h = '<div class="mini"><h4>Cumprimento por item · últimos 7 dias</h4><div class="bars">';
    ITEMS.forEach(function (it) { var tot = l7.length || 1, s = 0; l7.forEach(function (d) { s += done(S.C[d], it[0]); }); var pct = Math.round(s / tot * 100);
      h += '<div class="barrow"><span>' + it[1] + '</span><div class="track"><i style="width:' + pct + '%"></i></div><b>' + pct + '%</b></div>'; });
    return h + '</div><p class="ci-note">Dias sem check-in contam como não cumpridos.</p></div>';
  }
  function textList(title, fieldName) {
    var ks = Object.keys(S.C).sort().reverse().filter(function (d) { return S.C[d][fieldName]; }).slice(0, 10);
    var h = '<div class="mini"><h4>' + title + '</h4>';
    if (!ks.length) return h + '<p class="ci-note">Nada registrado ainda.</p></div>';
    return h + '<ul class="daylist">' + ks.map(function (d) { return '<li><span>' + br(d) + '</span><div>' + esc(S.C[d][fieldName]) + '</div></li>'; }).join("") + '</ul></div>';
  }

  function seg(name, list, val) {
    return '<div class="seg' + (name === "nota" ? " nota" : "") + '" role="radiogroup">' + list.map(function (o) {
      var id = "ci-" + name + "-" + o[0];
      return '<label for="' + id + '"><input type="radio" name="' + name + '" value="' + o[0] + '" id="' + id + '"' + (String(val) === String(o[0]) ? " checked" : "") + '><span>' + o[1] + '</span></label>';
    }).join("") + '</div>';
  }
  function q(label, ctl) { return '<div class="ci-q"><span>' + label + '</span>' + ctl + '</div>'; }

  function checkinForm(preview) {
    var t = today(), y = add(t, -1);
    if (!S.formDay) S.formDay = t;
    var d = S.formDay, c = S.C[d] || {}, prev = S.C[add(d, -1)], mine = S.A[d] && S.A[d].texto;
    var YN = [["sim", "Sim"], ["nao", "Não"]];
    var ynv = function (v) { return v === true ? "sim" : v === false ? "nao" : ""; };
    var h = '<div class="ci-card' + (preview ? " preview" : "") + '">';
    h += mine ? '<div class="ci-today"><small>Ação do dia · da sua mentora</small><b style="white-space:pre-wrap">' + esc(S.A[d].texto) + '</b></div>'
      : '<div class="ci-today"><small>Sua ação de empresária para ' + (d === t ? "hoje" : "este dia") + '</small><b>' + esc(prev && prev.acao_amanha ? prev.acao_amanha : "Defina abaixo a sua ação de empresária para amanhã.") + '</b></div>';
    h += '<div class="ci-head"><h3>Check-in de ' + (d === t ? "hoje" : "ontem") + ' · ' + br(d) + '</h3><div class="tabs2">' +
      [[t, "Hoje"], [y, "Ontem"]].map(function (o) { return '<button type="button" data-acao="formday" data-d="' + o[0] + '" aria-pressed="' + (d === o[0]) + '">' + o[1] + (S.C[o[0]] ? " ✓" : "") + '</button>'; }).join("") + '</div></div>';
    if (c.comentario_mentora) h += '<p class="comentario"><b>Comentário da sua mentora</b>' + multi(c.comentario_mentora) + '</p>';
    h += '<form data-form="checkin" style="display:grid;gap:16px" novalidate>';
    h += q(mine ? "Fiz a ação do dia?" : "Fiz a minha ação de empresária hoje?", '<div style="display:grid;gap:8px">' + seg("acao_feita", YN, ynv(c.acao_feita)) + '<textarea name="acao" placeholder="' + (mine ? "A sua resposta, ou como você cumpriu a ação do dia" : "Qual foi a ação?") + '">' + esc(c.acao) + '</textarea></div>');
    h += '<div class="ci-grid">' + q("Tempo com Deus", seg("deus", YN, ynv(c.deus))) +
      q("Agenda do dia", seg("agenda", [["sim", "Cumpri"], ["parcial", "Em parte"], ["nao", "Não cumpri"]], c.agenda || "")) +
      q("Uma ação de divulgação", seg("divulgacao", YN, ynv(c.divulgacao))) + q("Autocuidado", seg("autocuidado", YN, ynv(c.autocuidado))) +
      q("Fiz a tarefa da casa que planejei?", seg("casa", YN, ynv(c.casa))) +
      q("Atendimentos do dia", '<input type="number" name="atendimentos" min="0" max="30" inputmode="numeric" value="' + (c.atendimentos == null ? "" : c.atendimentos) + '">') + '</div>';
    h += q("O que eu adiei hoje e por quê", '<textarea name="adiei" placeholder="O que você deixou para depois e o que te levou a adiar?">' + esc(c.adiei) + '</textarea>');
    var notas = []; for (var i = 0; i <= 10; i++) notas.push([String(i), String(i)]);
    h += q("Meu compromisso hoje (0 a 10)", seg("nota", notas, c.nota == null ? "" : c.nota));
    h += q("Minha ação de empresária para amanhã (opcional)", '<input type="text" name="acao_amanha" placeholder="Ex.: postar 3 stories com antes e depois" value="' + esc(c.acao_amanha) + '">');
    h += preview ? '<p class="hint">Pré-visualização: é assim que ' + esc(primeiroNome()) + ' vê. Só ela pode enviar o check-in.</p>'
      : '<div class="btns"><button class="btn" type="submit">' + (S.C[d] ? "Atualizar check-in" : "Enviar check-in") + '</button></div>';
    return h + '</form></div>';
  }

  function planner() {
    var t = today(), tom = add(t, 1), last = "__", nome = esc(primeiroNome());
    var h = '<div class="ci-card"><div class="ci-head"><h3>Ações diárias</h3></div>' +
      '<p class="ci-note">Escreva a ação de cada dia. A de hoje e a de amanhã ficam visíveis para ' + nome + ' assim que você salva. As dos dias seguintes ficam guardadas e aparecem para ela automaticamente na véspera.</p>';
    for (var i = -3; i <= 13; i++) {
      var d = add(t, i), th = themeFor(d), key = th ? th.id : "";
      if (key !== last) { last = key; h += '<div class="plan-week"><b>' + (th ? "Semana do encontro " + hexNum(th) : "Antes do primeiro encontro") + '</b>' + (th ? '<span>' + esc(th.titulo) + '</span>' : "") + '</div>'; }
      var saved = S.A[d] && S.A[d].texto ? S.A[d].texto : "";
      var txt = S.drafts[d] != null ? S.drafts[d] : saved;
      var st = saved ? (d <= tom ? "lib" : "plan") : "";
      h += '<div class="plan-row' + (d === t ? " today" : "") + (d < t ? " past" : "") + '"><div class="plan-date"><b>' + br(d) + '</b><span>' + (d === t ? "Hoje" : d === tom ? "Amanhã" : DIAS[parse(d).getDay()]) + '</span></div>' +
        '<textarea rows="2" data-plan="' + d + '" placeholder="Ex.: Qual vai ser o seu pensamento de hoje como empresária?">' + esc(txt) + '</textarea>' +
        '<div class="plan-side"><span class="plan-chip ' + st + '">' + (st === "lib" ? "Liberada" : st === "plan" ? "Planejada" : "Sem ação") + '</span><button class="ghost pq" type="button" data-acao="plan-salvar" data-d="' + d + '">Salvar</button></div></div>';
    }
    return h + '</div>';
  }

  function dailyBody() {
    if (!S.owner) return checkinForm(false) + tiles() + '<div class="ci-card"><div class="mini"><h4>Sua constância · toque em um dia</h4></div>' + calendar() + '</div>';
    var nome = esc(primeiroNome());
    var h = '<div class="tabs2">' + [["panel", "Painel da mentora"], ["plan", "Ações diárias"], ["form", "Ver como " + nome + " vê"]].map(function (o) {
      return '<button type="button" data-acao="view" data-v="' + o[0] + '" aria-pressed="' + (S.view === o[0]) + '">' + o[1] + '</button>'; }).join("") + '</div>';
    if (S.view === "plan") return h + planner();
    if (S.view === "form") return h + checkinForm(true);
    var y = add(today(), -1), n = Object.keys(S.C).length;
    if (!n) h += '<div class="alert">Ainda não há nenhum check-in. Assim que ' + nome + ' enviar o primeiro, o painel começa a se preencher.</div>';
    else if (y >= firstDay() && !S.C[y]) h += '<div class="alert">' + nome + ' não fez o check-in de ontem (' + br(y) + '). Vale cobrar no grupo do WhatsApp.</div>';
    h += tiles();
    h += '<div class="panel2"><div class="ci-card"><div class="mini"><h4>Calendário · toque em um dia</h4></div>' + calendar() + '</div><div class="ci-card">' + bars() + '</div></div>';
    h += '<div class="panel2"><div class="ci-card">' + textList("O que ela anda adiando", "adiei") + '</div><div class="ci-card">' + textList("Ações e respostas do dia", "acao") + '</div></div>';
    return h;
  }

  /* ---------- encontros ---------- */
  function roteiroView(e) {
    return (e.objetivo ? '<p>' + esc(e.objetivo) + '</p>' : "") +
      '<dl><div><dt>Ferramenta</dt><dd>' + esc(e.ferramenta || "–") + '</dd></div><div><dt>Palavra</dt><dd>' + esc(e.versiculo || "–") + '</dd></div>' +
      '<div class="task"><dt>Hora de executar</dt><dd style="white-space:pre-wrap">' + esc(e.tarefa || "–") + '</dd></div></dl>';
  }
  function encontroHTML(e) {
    var feito = e.status === "realizado", aberto = !!S.abertos[e.id], nome = esc(primeiroNome());
    var pill = feito ? "Realizado" + (e.data ? " · " + dataBR(e.data) : "") : e.status === "remarcado" ? "Remarcado" + (e.data ? " · " + dataBR(e.data) : "") : e.status === "cancelado" ? "Cancelado" : (e.data ? "Agendado · " + dataBR(e.data) + " · " + horaBR(e.data) : "A agendar");
    var h = '<li class="enc' + (feito ? " is-done" : "") + (aberto ? "" : " closed") + '"><div class="hex" data-acao="toggle" data-id="' + e.id + '" style="cursor:pointer">' + hexNum(e) + '</div><div class="enc-body">' +
      '<div class="enc-head" role="button" tabindex="0" data-acao="toggle" data-id="' + e.id + '" aria-expanded="' + aberto + '"><div><span class="fase-tag">' + esc(e.fase) + '</span><span class="semana">' + esc(e.semana) + '</span><h3>' + esc(e.titulo) + '</h3></div><span class="pill st' + (feito ? " ok" : "") + '">' + pill + '</span><span class="chev" aria-hidden="true"></span></div>';
    var visivel = e.liberado || feito;
    if (!S.owner) {
      h += visivel ? roteiroView(e) : '<p class="locked">O conteúdo deste encontro será liberado pela sua mentora até um dia antes do encontro.</p>';
    } else if (S.lockEdit === e.id) {
      h += '<form class="lock-form" data-form="roteiro" data-id="' + e.id + '" novalidate>' +
        '<div class="row">' + field("Título", '<input name="titulo" value="' + esc(e.titulo) + '">') + field("Fase", '<input name="fase" value="' + esc(e.fase) + '">') + '</div>' +
        field("Objetivo do encontro", '<textarea name="objetivo">' + esc(e.objetivo) + '</textarea>') +
        '<div class="row">' + field("Ferramenta", '<input name="ferramenta" value="' + esc(e.ferramenta) + '">') + field("Palavra", '<input name="versiculo" value="' + esc(e.versiculo) + '">') + '</div>' +
        field("Hora de executar", '<textarea name="tarefa">' + esc(e.tarefa) + '</textarea>') +
        '<p class="erro" role="alert"></p><div class="btns"><button class="btn" type="submit">Salvar roteiro</button><button class="ghost" type="button" data-acao="roteiro-cancelar">Cancelar</button></div></form>';
    } else {
      h += '<div class="lockbar' + (e.liberado ? " on" : "") + '"><b>' + (e.liberado ? "Liberado para " + nome : "Ainda não liberado · só você vê") + '</b><div class="btns">' +
        '<button class="ghost pq" type="button" data-acao="roteiro-editar" data-id="' + e.id + '">Editar roteiro</button>' +
        (e.liberado ? '<button class="ghost pq" type="button" data-acao="liberar" data-id="' + e.id + '" data-v="0">Ocultar de novo</button>' : '<button class="btn pq" type="button" data-acao="liberar" data-id="' + e.id + '" data-v="1">Liberar para ' + nome + '</button>') +
        '</div></div>' + roteiroView(e);
    }
    var has = FIELDS.some(function (f) { return e[f[0]]; });
    h += '<div class="reg' + (has || S.editing === e.id ? " has" : "") + '">';
    if (S.owner && S.editing === e.id) {
      h += '<div class="reg-h"><strong>Registro do encontro</strong><small>Só você edita. ' + nome + ' vê assim que você salvar.</small></div>' +
        '<form data-form="registro" data-id="' + e.id + '" novalidate><div class="row">' +
        field("Data e horário", '<input name="data" type="datetime-local" value="' + paraInput(e.data) + '">') +
        field("Situação", '<select name="status">' + opts([["agendado", "Agendado"], ["realizado", "Realizado"], ["remarcado", "Remarcado"], ["cancelado", "Cancelado"]], e.status) + '</select>') + '</div>' +
        FIELDS.map(function (f) { return field(f[1], '<textarea name="' + f[0] + '">' + esc(e[f[0]]) + '</textarea>'); }).join("") +
        '<p class="erro" role="alert"></p><div class="btns"><button class="btn" type="submit">Salvar registro</button><button class="ghost" type="button" data-acao="registro-cancelar">Cancelar</button></div></form>';
    } else {
      h += '<div class="reg-h"><strong>Registro do encontro</strong>' + (S.owner ? '<button class="ghost pq" type="button" data-acao="registro-editar" data-id="' + e.id + '">' + (has ? "Editar registro" : "Registrar encontro") + '</button>' : "") + '</div>';
      if (!has) h += '<p class="empty">' + (S.owner ? "Nenhum registro ainda." : "O registro deste encontro aparece aqui depois que ele acontecer.") + '</p>';
      else h += '<div class="folds">' + FIELDS.filter(function (f) { return e[f[0]]; }).map(function (f) {
        return '<details class="fold"><summary><span>' + f[1] + '</span></summary><div class="fold-body note-b"><p>' + esc(e[f[0]]) + '</p></div></details>'; }).join("") + '</div>';
    }
    return h + '</div></div></li>';
  }

  function ajustesHTML() {
    var m = S.M;
    return '<section><details class="ajustes"><summary>Ajustes da mentoria · só você vê</summary>' +
      '<form data-form="plano" novalidate><div class="row">' +
      field("Programa", '<input name="programa" value="' + esc(m.programa) + '">') + field("Situação", '<select name="status">' + opts([["ativa", "Ativa"], ["pausada", "Pausada"], ["concluida", "Concluída"]], m.status) + '</select>') +
      field("Início", '<input name="inicio" type="date" value="' + esc(m.inicio || "") + '">') + field("Término", '<input name="fim" type="date" value="' + esc(m.fim || "") + '">') + '</div>' +
      field("Apresentação (topo da página; deixe uma linha em branco entre os parágrafos)", '<textarea name="descricao" rows="6">' + esc(m.descricao) + '</textarea>') +
      field("Formato (uma linha por item: Título | valor)", '<textarea name="formato">' + esc(linhas(m.formato)) + '</textarea>') +
      field("A trilha (uma fase por linha: Fase | descrição)", '<textarea name="fases">' + esc(linhas(m.fases)) + '</textarea>') +
      field("O que ela leva (um item por linha)", '<textarea name="entregas">' + esc(linhas(m.entregas)) + '</textarea>') +
      field("Nossos combinados (um por linha)", '<textarea name="combinados" rows="5">' + esc(linhas(m.combinados)) + '</textarea>') +
      '<p class="erro" role="alert"></p><div class="btns"><button class="btn" type="submit">Salvar ajustes</button></div></form>' +
      '<form data-form="aplicar-modelo" novalidate style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px"><span class="eyebrow">Aplicar um roteiro pronto</span>' +
      '<p class="hint" style="margin:0">Atenção: substitui todos os encontros desta mentorada pelos do modelo, inclusive os registros.</p>' +
      field("Modelo", '<select name="modelo"><option value="">Escolha…</option>' + opts(S.modelos.map(function (x) { return [x.id, x.nome]; }), "") + '</select>') +
      '<p class="erro" role="alert"></p><div class="btns"><button class="ghost" type="submit">Aplicar modelo</button></div></form>' +
      '</details></section>';
  }

  /* ---------- página ---------- */
  function render() {
    var m = S.M, nome = m.mentorada ? (m.mentorada.nome || m.mentorada.email) : "";
    var paras = (m.descricao || "").split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    var cont = S.E.filter(function (e) { return e.tipo !== "extra"; });
    var feitos = cont.filter(function (e) { return e.status === "realizado"; }).length;
    var fases = m.fases || [];

    var h = '<div class="wrap">';
    h += '<div class="hero"><span class="eyebrow">' + esc(m.programa) + ' · Sua trilha de mentoria</span><h1>' + esc(m.programa) + '</h1>' +
      paras.map(function (p, i) { return '<p' + (i ? ' class="publico"' : "") + '>' + esc(p) + '</p>'; }).join("") +
      '<div class="who"><span><span class="lbl">Mentorada</span><b>' + esc(nome) + '</b></span>' + (m.inicio ? '<span><span class="lbl">Início</span>' + dataBR(m.inicio) + '</span>' : "") +
      (S.owner ? '<span style="margin-left:auto" class="hint">Você está vendo a página de ' + esc(primeiroNome()) + ' com os controles da mentora.</span>' : "") + '</div>' +
      ((m.formato || []).length ? '<div class="formato">' + m.formato.map(function (f) { return '<div class="fmt"><span>' + esc(f[0]) + '</span><strong>' + esc(f[1]) + '</strong></div>'; }).join("") + '</div>' : "") +
      (!S.owner && S.lista.length > 1 ? '<div class="field" style="max-width:320px"><label>Mentoria</label><select data-acao="trocar">' + opts(S.lista.map(function (x) { return [x.id, x.programa]; }), S.selId) + '</select></div>' : "") +
      '</div>';

    h += '<section class="daily" id="checkin"><h2>Acompanhamento diário</h2><p class="daily-intro">Todos os dias, no fim do dia, um check-in rápido: o que você fez, o que adiou e qual será a sua ação de empresária de amanhã. É ele que transforma intenção em compromisso.</p><div id="daily-body">' + dailyBody() + '</div></section>';

    if (fases.length) h += '<section><h2>A trilha</h2><ol class="fases" style="--n:' + fases.length + '">' + fases.map(function (f, i) {
      var ids = S.E.filter(function (e) { return (e.fase || "").toLowerCase() === (f[0] || "").toLowerCase(); });
      var ok = ids.length && ids.every(function (e) { return e.status === "realizado"; });
      return '<li' + (ok ? ' class="done"' : "") + '><span class="fase-n">' + (ok ? "✓" : i + 1) + '</span><div><strong>' + esc(f[0]) + '</strong><small>' + esc(f[1] || "") + '</small></div></li>';
    }).join("") + '</ol></section>';

    h += '<section><h2>Seus encontros</h2><div class="progress"><span>Andamento</span><div class="bar"><i style="width:' + (cont.length ? feitos / cont.length * 100 : 0) + '%"></i></div><b>' + feitos + ' de ' + cont.length + ' realizados</b></div>' +
      '<ol class="encontros">' + S.E.map(encontroHTML).join("") + '</ol>' +
      (S.owner ? '<div class="btns"><button class="ghost pq" type="button" data-acao="novo-encontro">+ Adicionar encontro</button></div>' : "") + '</section>';

    if ((m.entregas || []).length) h += '<section><h2>O que você leva</h2><ul class="entregas">' + m.entregas.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></section>';
    if ((m.combinados || []).length) h += '<section class="combinados"><h2>Nossos combinados</h2><ul>' + m.combinados.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></section>';
    if (S.owner) h += ajustesHTML();
    h += '<footer><span>Grupo Kovan · Mentorias</span><span>Os registros de cada encontro são feitos pela sua mentora.</span></footer></div>';

    var ae = document.activeElement, keep = ae && ae.getAttribute && ae.getAttribute("data-plan");
    app.innerHTML = h;
    if (keep) { var el = app.querySelector('[data-plan="' + keep + '"]'); if (el) el.focus(); }
  }
  function renderDaily() { var b = document.getElementById("daily-body"); if (b) b.innerHTML = dailyBody(); else render(); }

  /* ---------- eventos ---------- */
  document.addEventListener("input", function (ev) { var d = ev.target.getAttribute && ev.target.getAttribute("data-plan"); if (d) S.drafts[d] = ev.target.value; });
  document.addEventListener("keydown", function (ev) {
    if ((ev.key === "Enter" || ev.key === " ") && ev.target.classList && ev.target.classList.contains("enc-head")) { ev.preventDefault(); ev.target.click(); }
  });
  document.addEventListener("change", function (ev) {
    if (ev.target.matches("[data-acao=trocar]")) { S.selId = ev.target.value; S.novo = false; S.view = "panel"; S.selDay = null; S.formDay = null; S.abertos = {}; S.editing = null; S.lockEdit = null; S.drafts = {}; carregaMentoria(); }
  });

  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-acao]");
    if (!b || b.tagName === "SELECT") return;
    var a = b.getAttribute("data-acao"), id = b.getAttribute("data-id");
    if (a === "sair") { await sb.auth.signOut(); reset(); return telaLogin(); }
    if (a === "ir-esqueci") return telaLogin("esqueci");
    if (a === "ir-login") return telaLogin();
    if (a === "novo") { S.novo = true; return carregaMentoria(); }
    if (a === "cancelar-novo") { S.novo = false; return carregaMentoria(); }
    if (a === "toggle") { S.abertos[id] = !S.abertos[id]; return render(); }
    if (a === "view") { S.view = b.getAttribute("data-v"); return renderDaily(); }
    if (a === "formday") { S.formDay = b.getAttribute("data-d"); return renderDaily(); }
    if (a === "dia") { var d = b.getAttribute("data-d"); S.selDay = S.selDay === d ? null : d; return renderDaily(); }
    if (a === "roteiro-editar") { S.lockEdit = id; S.abertos[id] = true; return render(); }
    if (a === "roteiro-cancelar") { S.lockEdit = null; return render(); }
    if (a === "registro-editar") { S.editing = id; S.abertos[id] = true; return render(); }
    if (a === "registro-cancelar") { S.editing = null; return render(); }
    if (a === "liberar") {
      var lib = b.getAttribute("data-v") === "1"; b.disabled = true;
      var r = await sb.from("encontros").update({ liberado: lib }).eq("id", id);
      if (r.error) { b.disabled = false; return toast(traduz(r.error)); }
      S.E.forEach(function (e) { if (e.id === id) e.liberado = lib; });
      toast(lib ? "Liberado. " + primeiroNome() + " já vê este encontro." : "Conteúdo oculto de novo."); return render();
    }
    if (a === "plan-salvar") {
      var dia = b.getAttribute("data-d"), ta = app.querySelector('[data-plan="' + dia + '"]'), txt = ta ? ta.value.trim() : "";
      b.disabled = true; b.textContent = "Salvando…";
      var rr = txt ? await sb.from("acoes").upsert({ mentoria_id: S.M.id, dia: dia, texto: txt }, { onConflict: "mentoria_id,dia" }).select().single()
        : await sb.from("acoes").delete().eq("mentoria_id", S.M.id).eq("dia", dia);
      if (rr.error) { b.disabled = false; b.textContent = "Salvar"; return toast(traduz(rr.error)); }
      if (txt) S.A[dia] = rr.data; else delete S.A[dia];
      delete S.drafts[dia];
      toast(!txt ? "Ação removida." : dia <= add(today(), 1) ? "Salva e já visível para " + primeiroNome() + "." : "Salva. Aparece para ela na véspera.");
      return renderDaily();
    }
    if (a === "novo-encontro") {
      var max = S.E.reduce(function (n, e) { return e.tipo === "extra" ? n : Math.max(n, e.numero || 0); }, 0);
      var ri = await sb.from("encontros").insert({ mentoria_id: S.M.id, numero: max + 1, titulo: "Novo encontro", tipo: "individual", fase: "", semana: "", liberado: false }).select().single();
      if (ri.error) return toast(traduz(ri.error));
      S.E.push(ri.data); S.E.sort(function (x, y) { return (x.numero || 0) - (y.numero || 0); });
      S.abertos[ri.data.id] = true; S.lockEdit = ri.data.id; return render();
    }
  });

  document.addEventListener("submit", async function (ev) {
    var f = ev.target.closest("form[data-form]");
    if (!f) return;
    ev.preventDefault();
    var t = f.getAttribute("data-form"), d = fd(f), id = f.getAttribute("data-id"), r;
    var btn = f.querySelector("[type=submit]");
    erroForm(f, ""); if (btn) btn.disabled = true;
    try {
      if (t === "login") {
        if (!d.email || !d.senha) throw { message: "Preencha e-mail e senha." };
        r = await sb.auth.signInWithPassword({ email: d.email, password: d.senha });
        if (r.error) throw r.error;
        return rota();
      }
      if (t === "esqueci") {
        if (!d.email) throw { message: "Informe o seu e-mail." };
        r = await sb.auth.resetPasswordForEmail(d.email, { redirectTo: location.origin + location.pathname });
        if (r.error) throw r.error;
        erroForm(f, "Se o e-mail estiver cadastrado, você vai receber um link em instantes.", true); return;
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
        r = await sb.functions.invoke("convidar", { body: { nome: d.nome, email: d.email, programa: d.programa, inicio: d.inicio || null, redirectTo: location.origin + location.pathname } });
        if (r.error) { var det = r.error.context && r.error.context.json ? await r.error.context.json().catch(function () { return null; }) : null; throw { message: (det && det.erro) || r.error.message }; }
        if (r.data && r.data.erro) throw { message: r.data.erro };
        if (d.modelo) await sb.rpc("aplicar_modelo", { p_mentoria: r.data.mentoria_id, p_modelo: d.modelo });
        else if (d.programa === "Jornada Lapidar") await sb.rpc("criar_encontros_lapidar", { p_mentoria: r.data.mentoria_id });
        S.novo = false; S.selId = r.data.mentoria_id;
        toast(r.data.convidada ? "Convite enviado para " + d.email + "." : "Ela já tinha cadastro: a nova mentoria foi adicionada à área dela.");
        await carregaLista(); return carregaMentoria();
      }
      if (t === "checkin") {
        var rv = function (n) { var x = f.querySelector("input[name=" + n + "]:checked"); return x ? x.value : ""; };
        var yb = function (n) { var v = rv(n); return v === "sim" ? true : v === "nao" ? false : null; };
        var dia = S.formDay || today(), mine = S.A[dia] && S.A[dia].texto;
        var row = { mentoria_id: S.M.id, mentorada_id: S.sessao.user.id, dia: dia,
          acao_feita: yb("acao_feita"), acao: d.acao, acao_do_dia: mine || "", deus: yb("deus"), agenda: rv("agenda") || null,
          divulgacao: yb("divulgacao"), autocuidado: yb("autocuidado"), casa: yb("casa"),
          atendimentos: d.atendimentos === "" ? null : Math.max(0, parseInt(d.atendimentos, 10) || 0),
          adiei: d.adiei, nota: rv("nota") === "" ? null : +rv("nota"), acao_amanha: d.acao_amanha };
        var falta = ["acao_feita", "deus", "agenda", "divulgacao", "autocuidado", "casa"].filter(function (k) { return row[k] == null; });
        if (falta.length) { toast("Responda todos os itens de sim ou não antes de enviar."); return; }
        if (btn) btn.textContent = "Enviando…";
        r = await sb.from("checkins").upsert(row, { onConflict: "mentoria_id,dia" }).select().single();
        if (r.error) throw r.error;
        S.C[dia] = r.data; toast("Check-in enviado. Continue firme!"); return renderDaily();
      }
      if (t === "comentario") {
        r = await sb.from("checkins").update({ comentario_mentora: d.comentario_mentora }).eq("id", id).select().single();
        if (r.error) throw r.error;
        S.C[r.data.dia] = r.data; toast("Comentário salvo. Ela já vê."); return;
      }
      if (t === "roteiro") {
        var up = { titulo: d.titulo, fase: d.fase, objetivo: d.objetivo, ferramenta: d.ferramenta, versiculo: d.versiculo, tarefa: d.tarefa };
        r = await sb.from("encontros").update(up).eq("id", id).select().single();
        if (r.error) throw r.error;
        S.E = S.E.map(function (e) { return e.id === id ? r.data : e; }); S.lockEdit = null;
        toast(r.data.liberado ? "Roteiro salvo e atualizado para " + primeiroNome() + "." : "Roteiro salvo. Só você vê até liberar."); return render();
      }
      if (t === "registro") {
        var reg = { data: deInput(d.data), status: d.status };
        FIELDS.forEach(function (x) { reg[x[0]] = d[x[0]]; });
        r = await sb.from("encontros").update(reg).eq("id", id).select().single();
        if (r.error) throw r.error;
        S.E = S.E.map(function (e) { return e.id === id ? r.data : e; }); S.editing = null;
        toast("Registro salvo. " + primeiroNome() + " já vê."); return render();
      }
      if (t === "plano") {
        var pl = { programa: d.programa, status: d.status, inicio: d.inicio || null, fim: d.fim || null, descricao: d.descricao, formato: deLinhas(d.formato, true), fases: deLinhas(d.fases, true), entregas: deLinhas(d.entregas), combinados: deLinhas(d.combinados) };
        r = await sb.from("mentorias").update(pl).eq("id", S.M.id);
        if (r.error) throw r.error;
        Object.assign(S.M, pl); toast("Ajustes salvos."); pintaTopo(); return render();
      }
      if (t === "aplicar-modelo") {
        if (!d.modelo) throw { message: "Escolha um modelo." };
        if (!window.confirm("Substituir todos os encontros desta mentorada pelos do modelo? Os registros feitos serão perdidos.")) return;
        r = await sb.rpc("aplicar_modelo", { p_mentoria: S.M.id, p_modelo: d.modelo });
        if (r.error) throw r.error;
        toast("Modelo aplicado."); await carregaLista(); return carregaMentoria();
      }
    } catch (e) {
      erroForm(f, traduz(e)); if (!f.querySelector(".erro")) toast(traduz(e));
    } finally {
      if (btn && document.body.contains(btn)) { btn.disabled = false; if (t === "checkin") btn.textContent = S.C[S.formDay || today()] ? "Atualizar check-in" : "Enviar check-in"; }
    }
  });

  /* ---------- início ---------- */
  sb.auth.onAuthStateChange(function (evento) {
    if (evento === "PASSWORD_RECOVERY") { hashTipo = "recovery"; setTimeout(telaSenha, 0); }
  });
  (async function () {
    var r = await sb.auth.getSession();
    if (r.data.session && (hashTipo === "invite" || hashTipo === "recovery")) { S.sessao = r.data.session; return telaSenha(); }
    rota();
  })();
})();
