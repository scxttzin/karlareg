/* ===== KarlaReg — interface do caderno ===== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var LIMITE_COMENTARIO = 45;
  var estado = {
    tagsNovas: [], fotosNovas: [], fotoSel: 0, corTag: 0,
    abaAtual: 'inicio', edicao: null, cardAberto: null, slide: 0,
    editandoFoto: false, editandoAnotacao: false
  };

  /* ---------- utilidades ---------- */
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function corDaTag(chave) {
    var s = 0, t = String(chave || '').toLowerCase();
    for (var i = 0; i < t.length; i++) s += t.charCodeAt(i);
    return s % 4;
  }
  function inclinacao(id) {
    var s = 0;
    for (var i = 0; i < id.length; i++) s += id.charCodeAt(i);
    return ((s % 9) - 4) * 0.6;
  }
  /* 0 esquerda, 1 centro, 2 direita — sempre o mesmo canto para a mesma peça */
  function posicaoFita(id) {
    var s = 0;
    for (var i = 0; i < id.length; i++) s += id.charCodeAt(i) * (i + 3);
    return s % 3;
  }
  function dataCurta(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
  function dataNumerica(ms) {
    var d = new Date(ms);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }
  /* aaaa-mm-dd para o input de data, sempre no fuso local */
  function paraCampoData(ms) {
    var d = new Date(ms), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  /* guarda o dia escolhido com a hora de agora: o dia é o que aparece na tela,
     e a hora serve de desempate — sem ela, tudo criado no mesmo dia empatava
     e a ordem das recentes ficava aleatória */
  function doCampoData(valor) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor || '');
    if (!m) return null;
    var agora = new Date();
    return new Date(+m[1], +m[2] - 1, +m[3],
      agora.getHours(), agora.getMinutes(), agora.getSeconds(), agora.getMilliseconds()).getTime();
  }
  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  var ICO = {
    coracao: '<svg viewBox="0 0 24 24"><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.3-8.5 11.3z"/></svg>',
    aviao: '<svg viewBox="0 0 24 24"><path d="M21 3 10.5 14.2"/><path d="M21 3 14.4 21l-3.9-6.8L3.6 10.4 21 3z"/></svg>',
    balao: '<svg viewBox="0 0 24 24"><path d="M20.5 12.2c0 4-3.8 7.2-8.5 7.2a10 10 0 0 1-2.9-.4L4 20.6l1.5-3.9a6.9 6.9 0 0 1-2-4.5C3.5 8.2 7.3 5 12 5s8.5 3.2 8.5 7.2z"/></svg>',
    lapis: '<svg viewBox="0 0 24 24"><path d="M15.6 4.4 19.6 8.4 8.6 19.4 4 20.6l1.2-4.6z"/><path d="M13.8 6.2 17.8 10.2"/></svg>',
    lixo: '<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15"/><path d="M9.5 6.5V4.6h5v1.9"/><path d="M6.4 6.5 7.3 20h9.4l.9-13.5"/></svg>',
    pino: '<svg viewBox="0 0 24 24"><path d="M12 15.5V21"/><path d="M8.4 4.5h7.2l-1 5.2 2.7 2.6a1 1 0 0 1-.7 1.7H7.4a1 1 0 0 1-.7-1.7l2.7-2.6z"/></svg>'
  };

  /* alfinete desenhado no mesmo traço do caderno: contorno azul e cabeça cheia */
  var ALFINETE =
    '<span class="alfinete" aria-hidden="true">' +
      '<svg viewBox="0 0 44 52">' +
        '<path class="agulha" d="M22 30 L22 49"/>' +
        '<ellipse class="cabeca" cx="22" cy="19" rx="14" ry="13"/>' +
        '<path class="brilho" d="M14 13.5a9 9 0 0 1 7-4.5"/>' +
      '</svg>' +
    '</span>';

  /* ---------- navegação entre folhas ---------- */

  function irPara(aba) {
    if (aba === estado.abaAtual) return;
    var inicio = $('#sheet-inicio');
    if (aba === 'galeria') inicio.classList.add('is-flipped');
    else inicio.classList.remove('is-flipped');
    estado.abaAtual = aba;
    $('#pages').dataset.aba = aba;

    /* só a aba aberta fica na frente: a outra vai para trás na hora */
    $$('.tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.goto === aba); });
  }
  $$('.tab').forEach(function (b) {
    b.addEventListener('click', function () { irPara(b.dataset.goto); });
  });

  /* a barra da Galeria só aparece enquanto se rola; some sozinha depois */
  (function () {
    var folha = $('#galeriaScroll'), sumir;
    folha.addEventListener('scroll', function () {
      folha.classList.add('rolando-agora');
      clearTimeout(sumir);
      sumir = setTimeout(function () { folha.classList.remove('rolando-agora'); }, 900);
    }, { passive: true });
  })();

  /* ---------- foto ---------- */
  function lerFoto(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1000;
        var esc2 = Math.min(1, max / Math.max(img.width, img.height));
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * esc2);
        cv.height = Math.round(img.height * esc2);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ---------- formulário de nova criação ---------- */
  var newCard = $('#newCard');
  var inicioRow = $('#inicioRow');
  var folhaInicio = $('#sheet-inicio .sheet-inner');

  function abrirFormulario() {
    newCard.classList.add('is-open');
    inicioRow.classList.add('is-editing');
    folhaInicio.classList.add('rolando');   /* o formulário é alto: libera a rolagem */
    pintarFotosNovas();   /* garante o bloco "adicionar foto" sempre visível */
    if (!estado.edicao && !$('#dataInput').value) {
      $('#dataInput').value = paraCampoData(Date.now());   /* hoje, por padrão */
    }
    $('#nomeInput').focus();
  }
  $('#newCardFace').addEventListener('click', abrirFormulario);

  /* atalho da galeria: volta para o Início já com o formulário aberto */
  $('#novaNaGaleria').addEventListener('click', function () {
    irPara('inicio');
    setTimeout(abrirFormulario, 620);
  });
  $('#cancelNew').addEventListener('click', limparFormulario);

  /* ----- galeria de fotos do formulário (até 6) ----- */
  function pintarFotosNovas() {
    var max = Store.MAX_FOTOS;
    var html = estado.fotosNovas.map(function (f, i) {
      return '<div class="thumb' + (i === estado.fotoSel ? ' is-sel' : '') + '" data-i="' + i + '"' +
        ' title="arraste para mudar a ordem">' +
        '<img src="' + f.src + '" alt="foto ' + (i + 1) + '" draggable="false">' +
        (i === 0 ? '<span class="capa">capa</span>' : '') +
        (f.nota ? '<span class="tem-nota" title="' + esc(f.nota) + '"></span>' : '') +
        '<button type="button" class="rm" data-rm-foto="' + i + '" title="remover">&times;</button>' +
        '</div>';
    }).join('');
    if (estado.fotosNovas.length < max) {
      html += '<button type="button" class="thumb add" id="addFoto"><span class="plus-mini"></span>foto</button>';
    }
    $('#fotosGrid').innerHTML = html;
    $('#contaFotos').textContent = estado.fotosNovas.length + '/' + max;

    var temFotos = estado.fotosNovas.length > 0;
    $('#fotoNotaWrap').hidden = !temFotos;
    if (temFotos) {
      if (estado.fotoSel >= estado.fotosNovas.length) estado.fotoSel = estado.fotosNovas.length - 1;
      $('#fotoNotaIdx').textContent = (estado.fotoSel + 1) + ' de ' + estado.fotosNovas.length;
      $('#fotoNota').value = estado.fotosNovas[estado.fotoSel].nota;
    }
  }

  /* ----- arrastar as miniaturas para reordenar (a primeira é a capa) ----- */
  (function () {
    var grade = $('#fotosGrid');
    var arrasto = null;

    function alvoSob(x, y) {
      var el = document.elementFromPoint(x, y);
      var t = el && el.closest ? el.closest('.thumb') : null;
      return (t && !t.classList.contains('add')) ? t : null;
    }
    function limpar() {
      $$('.thumb', grade).forEach(function (t) {
        t.classList.remove('arrastando', 'alvo');
      });
    }

    grade.addEventListener('pointerdown', function (e) {
      if (e.target.closest('[data-rm-foto]')) return;   /* o × não arrasta */
      var t = e.target.closest('.thumb');
      if (!t || t.classList.contains('add')) return;
      arrasto = { de: +t.dataset.i, x: e.clientX, y: e.clientY, movendo: false, el: t };
      grade.setPointerCapture(e.pointerId);
    });

    grade.addEventListener('pointermove', function (e) {
      if (!arrasto) return;
      if (!arrasto.movendo) {
        if (Math.abs(e.clientX - arrasto.x) + Math.abs(e.clientY - arrasto.y) < 7) return;
        arrasto.movendo = true;
        arrasto.el.classList.add('arrastando');
      }
      var sobre = alvoSob(e.clientX, e.clientY);
      $$('.thumb', grade).forEach(function (t) { t.classList.remove('alvo'); });
      if (sobre && sobre !== arrasto.el) sobre.classList.add('alvo');
    });

    grade.addEventListener('pointerup', function (e) {
      if (!arrasto) return;
      var mexeu = arrasto.movendo;
      var de = arrasto.de;
      var sobre = mexeu ? alvoSob(e.clientX, e.clientY) : null;
      limpar();
      arrasto = null;
      if (!mexeu) return;                    /* foi só um toque: o clique cuida */
      estado.arrastou = true;                /* evita o clique que vem logo atrás */
      if (!sobre) { pintarFotosNovas(); return; }
      var para = +sobre.dataset.i;
      if (para === de) { pintarFotosNovas(); return; }
      var item = estado.fotosNovas.splice(de, 1)[0];
      estado.fotosNovas.splice(para, 0, item);
      estado.fotoSel = para;
      pintarFotosNovas();
      toast(para === 0 ? 'essa foto virou a capa' : 'ordem das fotos atualizada');
    });

    grade.addEventListener('pointercancel', function () { limpar(); arrasto = null; });
  })();

  $('#fotosGrid').addEventListener('click', function (e) {
    if (estado.arrastou) { estado.arrastou = false; return; }
    var rm = e.target.closest('[data-rm-foto]');
    if (rm) {
      estado.fotosNovas.splice(+rm.dataset.rmFoto, 1);
      pintarFotosNovas();
      return;
    }
    if (e.target.closest('#addFoto')) { $('#fotoInput').click(); return; }
    var t = e.target.closest('.thumb');
    if (t && t.dataset.i !== undefined) {
      estado.fotoSel = +t.dataset.i;
      pintarFotosNovas();
      $('#fotoNota').focus();
    }
  });

  $('#fotoNota').addEventListener('input', function () {
    if (!estado.fotosNovas[estado.fotoSel]) return;
    estado.fotosNovas[estado.fotoSel].nota = $('#fotoNota').value;
  });

  $('#fotoInput').addEventListener('change', function (e) {
    var arquivos = Array.prototype.slice.call(e.target.files);
    var livres = Store.MAX_FOTOS - estado.fotosNovas.length;
    if (arquivos.length > livres) {
      toast('cada criação aceita no máximo ' + Store.MAX_FOTOS + ' fotos');
      arquivos = arquivos.slice(0, livres);
    }
    var pendentes = arquivos.length;
    arquivos.forEach(function (arq) {
      lerFoto(arq, function (dataUrl) {
        estado.fotosNovas.push({ src: dataUrl, nota: '' });
        if (--pendentes === 0) {
          estado.fotoSel = estado.fotosNovas.length - 1;
          pintarFotosNovas();
        }
      });
    });
    e.target.value = '';   /* permite escolher o mesmo arquivo de novo */
  });

  /* ----- tags com cor ----- */
  $('#coresTag').addEventListener('click', function (e) {
    var s = e.target.closest('.swatch');
    if (!s) return;
    estado.corTag = +s.dataset.cor;
    $$('.swatch', $('#coresTag')).forEach(function (b) {
      b.classList.toggle('is-on', b === s);
    });
  });

  function pintarTagsNovas() {
    $('#tagsNovas').innerHTML = estado.tagsNovas.map(function (t, i) {
      return '<span class="tag" data-c="' + corDe(t) + '"><b>' + esc(t.chave) +
        '</b>' + esc(t.valor) + '<span class="x" data-rm="' + i + '">&times;</span></span>';
    }).join('');
  }
  $('#tagsNovas').addEventListener('click', function (e) {
    var i = e.target.dataset.rm;
    if (i === undefined) return;
    estado.tagsNovas.splice(+i, 1);
    pintarTagsNovas();
  });

  function adicionarTag() {
    var chave = $('#tagChave').value.trim();
    var valor = $('#tagValor').value.trim();
    if (!chave && !valor) return;
    if (!valor) { valor = chave; chave = ''; }   /* só um campo preenchido: vira o texto da tag */
    estado.tagsNovas.push({ chave: chave, valor: valor, cor: estado.corTag });
    $('#tagChave').value = '';
    $('#tagValor').value = '';
    $('#tagChave').focus();
    pintarTagsNovas();
  }
  $('#addTag').addEventListener('click', adicionarTag);
  ['#tagChave', '#tagValor'].forEach(function (sel) {
    $(sel).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); adicionarTag(); }
    });
  });

  function limparFormulario() {
    estado.tagsNovas = [];
    estado.fotosNovas = [];
    estado.fotoSel = 0;
    estado.edicao = null;
    $('#nomeInput').value = '';
    $('#tagChave').value = '';
    $('#tagValor').value = '';
    $('#descricaoInput').value = '';
    $('#dataInput').value = paraCampoData(Date.now());
    estado.diaOriginal = '';
    $('#fotoNota').value = '';
    $('#fotoInput').value = '';   /* sem isto a mesma foto nao dispara change de novo */
    $('#salvarNovo').textContent = 'colar no caderno';
    pintarTagsNovas();
    pintarFotosNovas();
    newCard.classList.remove('is-open');
    inicioRow.classList.remove('is-editing');
    folhaInicio.classList.remove('rolando');
    folhaInicio.scrollTop = 0;
  }

  $('#newCardForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var nome = $('#nomeInput').value.trim();
    if (!nome) { toast('dê um nome à criação'); $('#nomeInput').focus(); return; }

    /* a tag que ficou escrita nos campos, sem clicar em "adicionar",
       era perdida em silêncio ao salvar; agora ela entra junto */
    adicionarTag();

    var dados = {
      nome: nome,
      tags: estado.tagsNovas.slice(),
      fotos: estado.fotosNovas.slice(),
      descricao: $('#descricaoInput').value.trim()
    };
    /* editar não muda a posição na fila: a data só é regravada se você
       de fato escolheu outro dia */
    var dia = $('#dataInput').value;
    if (dia && dia !== estado.diaOriginal) {
      var quando = doCampoData(dia);
      if (quando) dados.criadoEm = quando;
    }

    /* enquanto sobe as fotos, o botão mostra que está trabalhando */
    var botao = $('#salvarNovo');
    var rotulo = botao.textContent;
    botao.disabled = true;
    botao.textContent = estado.edicao ? 'salvando...' : 'colando...';

    try {
      if (estado.edicao) {
        await Store.atualizar(estado.edicao, dados);
        toast('criação atualizada');
      } else {
        var nova = await Store.criar(dados);
        if (!nova) return;   /* deu erro: o aviso já apareceu */
        toast('criação colada no caderno');
      }
      limparFormulario();
      render();
    } finally {
      botao.disabled = false;
      botao.textContent = rotulo;
    }
  });

  /* ---------- busca ---------- */
  function combina(c, termo) {
    if (!termo) return true;
    termo = termo.toLowerCase();
    if (c.nome.toLowerCase().indexOf(termo) > -1) return true;
    if (c.descricao.toLowerCase().indexOf(termo) > -1) return true;
    return c.tags.some(function (t) {
      return (t.chave + ' ' + t.valor).toLowerCase().indexOf(termo) > -1;
    });
  }
  (function () {
    var input = $('#busca-galeria');
    input.addEventListener('input', function () {
      var campo = input.closest('.search-field');
      campo.classList.toggle('is-typing', input.value.length > 0);
      render();
    });
  })();

  /* ---------- cards ---------- */
  function corDe(t) {
    return (t.cor === 0 || t.cor) ? t.cor : corDaTag(t.chave);
  }
  function htmlTags(tags) {
    return '<div class="tag-list">' + tags.map(function (t) {
      return '<span class="tag" data-c="' + corDe(t) + '"><b>' + esc(t.chave) + '</b>' + esc(t.valor) + '</span>';
    }).join('') + '</div>';
  }

  function htmlCard(c) {
    var foto = c.foto
      ? '<img class="sticker-photo" src="' + c.foto + '" alt="' + esc(c.nome) + '">'
      : '<div class="sticker-photo"></div>';
    return '' +
      '<article class="sticker' + (c.fixado ? ' fixado' : '') + '" data-id="' + c.id + '"' +
        ' data-fita="' + posicaoFita(c.id) + '"' +
        ' style="--tilt:' + inclinacao(c.id) + 'deg">' +
        (c.fixado ? ALFINETE : '') +
        '<div class="sticker-foto-wrap">' + foto + '</div>' +
        '<div class="sticker-head">' +
          '<h3 class="sticker-name">' + esc(c.nome) + '</h3>' +
          '<time class="card-date">' + dataNumerica(c.criadoEm) + '</time>' +
        '</div>' +
        htmlTags(c.tags.slice(0, 6)) +
        '<div class="social">' +
          '<button data-acao="curtir" class="' + (c.curtido ? 'liked' : '') + '" title="curtir">' + ICO.coracao + '<span>' + (c.likes || 0) + '</span></button>' +
          '<button data-acao="comentar" title="comentar">' + ICO.balao + '<span>' + c.comentarios.length + '</span></button>' +
          '<button data-acao="compartilhar" title="compartilhar">' + ICO.aviao + '</button>' +
          '<span class="spacer"></span>' +
          '<span class="card-tools">' +
            '<button data-acao="editar" title="editar">' + ICO.lapis + '</button>' +
            '<button data-acao="excluir" title="excluir">' + ICO.lixo + '</button>' +
          '</span>' +
        '</div>' +
      '</article>';
  }

  async function render() {
    var lista = await Store.listar();

    /* Início: à esquerda a fixada (se houver), à direita a mais recente.
       Sem nenhuma fixada, ficam as duas últimas, como antes. */
    var fixada = lista.filter(function (c) { return c.fixado; })[0];
    var destaque;
    if (fixada) {
      var maisNova = lista.filter(function (c) { return c.id !== fixada.id; })[0];
      destaque = maisNova ? [fixada, maisNova] : [fixada];
    } else {
      destaque = lista.slice(0, 2);
    }
    $('#recentes').innerHTML = destaque.map(htmlCard).join('');
    $('#vazioInicio').hidden = destaque.length > 0;

    var tGal = $('#busca-galeria').value.trim();
    var gal = lista.filter(function (c) { return combina(c, tGal); });
    $('#galeriaGrid').innerHTML = gal.map(htmlCard).join('');
    $('#vazioGaleria').hidden = gal.length > 0;
    $('#vazioGaleria').textContent = lista.length
      ? 'nenhuma criação encontrada para esta busca.'
      : 'a galeria está vazia.';
  }

  /* cliques nos cards (delegação) */
  ['#recentes', '#galeriaGrid'].forEach(function (sel) {
    $(sel).addEventListener('click', async function (e) {
      var card = e.target.closest('.sticker');
      if (!card) return;
      var id = card.dataset.id;
      var btn = e.target.closest('[data-acao]');

      if (!btn) { abrirCard(id); return; }
      e.stopPropagation();

      switch (btn.dataset.acao) {
        case 'curtir':
          await Store.alternarCurtida(id);
          btn.classList.add('beat');
          await render();
          break;
        case 'comentar':
          abrirCard(id, true);
          break;
        case 'compartilhar':
          abrirCompartilhar(id);
          break;
        case 'editar':
          editarCard(id);
          break;
        case 'excluir':
          if (confirm('Excluir esta criação do caderno?')) {
            await Store.excluir(id);
            toast('criação removida');
            render();
          }
          break;
      }
    });
  });

  /* ---------- editar ---------- */
  async function editarCard(id) {
    var c = await Store.obter(id);
    if (!c) return;
    estado.edicao = id;
    estado.tagsNovas = c.tags.map(function (t) { return { chave: t.chave, valor: t.valor, cor: corDe(t) }; });
    estado.fotosNovas = c.fotos.map(function (f) { return { src: f.src, nota: f.nota }; });
    estado.fotoSel = 0;
    $('#nomeInput').value = c.nome;
    $('#descricaoInput').value = c.descricao;
    $('#dataInput').value = paraCampoData(c.criadoEm);
    estado.diaOriginal = paraCampoData(c.criadoEm);   /* para saber se a data mudou */
    $('#salvarNovo').textContent = 'salvar alterações';
    pintarTagsNovas();
    pintarFotosNovas();
    newCard.classList.add('is-open');
    inicioRow.classList.add('is-editing');
    folhaInicio.classList.add('rolando');
    fecharModal();
    irPara('inicio');
    setTimeout(function () { $('#nomeInput').focus(); }, 500);
  }

  /* ---------- modal do card ---------- */
  var overlay = $('#overlay');
  var modal = $('#modal');

  async function abrirCard(id, focoComentario) {
    var c = await Store.obter(id);
    if (!c) return;
    estado.cardAberto = c;
    estado.slide = 0;
    estado.editandoFoto = false;
    estado.editandoAnotacao = false;
    modal.innerHTML = htmlModal(c);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    if (history.replaceState) history.replaceState(null, '', '#/criacao/' + id);
    if (focoComentario) $('#comentarioInput', modal).focus();
    ligarModal(c);
  }

  function htmlCarrossel(c) {
    if (!c.fotos.length) return '<div class="modal-photo"></div>';
    var f = c.fotos[estado.slide] || c.fotos[0];
    var varias = c.fotos.length > 1;
    return '' +
      '<div class="carrossel">' +
        '<img class="modal-photo" id="slideFoto" src="' + f.src + '" alt="' + esc(c.nome) + '">' +
        (varias
          ? '<button class="seta prev" data-m="anterior" title="foto anterior">&lsaquo;</button>' +
            '<button class="seta next" data-m="proxima" title="próxima foto">&rsaquo;</button>' +
            '<span class="contador-foto">' + (estado.slide + 1) + '/' + c.fotos.length + '</span>'
          : '') +
      '</div>' +
      (varias
        ? '<div class="bolinhas" id="bolinhas">' + c.fotos.map(function (_, i) {
            return '<button class="bolinha' + (i === estado.slide ? ' is-on' : '') + '" data-slide="' + i + '"></button>';
          }).join('') + '</div>'
        : '') +
      htmlNotaFoto(f);
  }

  /* nota da foto: vazia (botão reduzido), salva (só a letra + lápis) ou em edição */
  function htmlNotaFoto(f) {
    if (estado.editandoFoto) {
      return '<div class="nota-bloco editando">' +
        '<label class="block-title" for="notaFotoInput">nota desta foto</label>' +
        '<div class="linha">' +
          '<input id="notaFotoInput" maxlength="120" placeholder="escreva a nota desta foto" value="' + esc(f.nota) + '">' +
          '<button class="mini-btn" data-m="salvarNotaFoto">salvar</button>' +
        '</div>' +
        '<div class="acoes-nota">' +
          (f.nota ? '<button class="link-btn" data-m="excluirNotaFoto">excluir</button>' : '') +
          '<button class="link-btn" data-m="cancelarNotaFoto">cancelar</button>' +
        '</div>' +
      '</div>';
    }
    if (!f.nota) {
      return '<button class="add-nota" data-m="editarNotaFoto">' +
        '<span class="mais">+</span> nota desta foto</button>';
    }
    return '<div class="nota-vista">' +
      '<p class="nota-texto">' + esc(f.nota) + '</p>' +
      '<button class="edit-nota" data-m="editarNotaFoto" title="editar nota">' + ICO.lapis + '</button>' +
    '</div>';
  }

  /* anotação do card: mesmos três estados, com a letra do quadro branco */
  function htmlAnotacao(c) {
    if (estado.editandoAnotacao) {
      return '<p class="block-title">anotação</p>' +
        '<div class="note-board">' +
          '<div class="inner">' +
            '<textarea id="anotacaoInput" placeholder="escreva aqui...">' + esc(c.anotacao) + '</textarea>' +
          '</div>' +
          '<div class="note-save">' +
            (c.anotacao ? '<button class="link-btn" data-m="excluirAnotacao">excluir</button>' : '') +
            '<button class="link-btn" data-m="cancelarAnotacao">cancelar</button>' +
            '<button class="mini-btn" data-m="salvarNota">guardar anotação</button>' +
          '</div>' +
        '</div>';
    }
    if (!c.anotacao) {
      return '<button class="add-nota" data-m="editarAnotacao">' +
        '<span class="mais">+</span> adicionar anotação</button>';
    }
    return '<div class="nota-vista anotacao">' +
      '<p class="anotacao-texto">' + esc(c.anotacao) + '</p>' +
      '<button class="edit-nota" data-m="editarAnotacao" title="editar anotação">' + ICO.lapis + '</button>' +
    '</div>';
  }

  function htmlModal(c) {
    return '' +
      '<button class="modal-pin' + (c.fixado ? ' preso' : '') + '" data-m="fixar"' +
        ' title="' + (c.fixado ? 'soltar do Início' : 'fixar no Início') + '">' + ICO.pino + '</button>' +
      '<button class="modal-close" data-fechar>&times;</button>' +
      '<div class="modal-grid">' +
        '<div>' +
          '<div id="areaFotos">' + htmlCarrossel(c) + '</div>' +
          '<div class="social" style="margin-top:14px">' +
            '<button data-m="curtir" class="' + (c.curtido ? 'liked' : '') + '">' + ICO.coracao + '<span>' + (c.likes || 0) + '</span></button>' +
            '<button data-m="comentar">' + ICO.balao + '<span>' + c.comentarios.length + '</span></button>' +
            '<button data-m="compartilhar">' + ICO.aviao + '</button>' +
            '<span class="spacer"></span>' +
            '<span class="card-tools">' +
              '<button data-m="editar">' + ICO.lapis + '</button>' +
              '<button data-m="excluir">' + ICO.lixo + '</button>' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<h2>' + esc(c.nome) + '</h2>' +
          '<p class="meta">criada em ' + dataCurta(c.criadoEm) + '</p>' +
          (c.descricao ? '<p class="descricao">' + esc(c.descricao) + '</p>' : '') +
          '<p class="block-title">tags</p>' +
          (c.tags.length ? htmlTags(c.tags) : '<p class="empty-note">sem tags</p>') +
          '<div id="areaAnotacao">' + htmlAnotacao(c) + '</div>' +
          '<p class="block-title">comentários</p>' +
          '<div class="reviews">' +
            '<div class="review-list" id="listaComentarios">' + htmlComentarios(c.comentarios) + '</div>' +
            '<div class="review-form">' +
              '<input id="comentarioInput" maxlength="' + LIMITE_COMENTARIO + '" placeholder="um comentário breve">' +
              '<button class="solid-btn" data-m="enviarComentario">enviar</button>' +
            '</div>' +
            '<p class="counter" id="contador">0/' + LIMITE_COMENTARIO + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function repintarFotos(c) {
    $('#areaFotos', modal).innerHTML = htmlCarrossel(c);
  }
  function repintarAnotacao(c) {
    $('#areaAnotacao', modal).innerHTML = htmlAnotacao(c);
  }

  /* troca a foto do carrossel guardando antes a nota digitada */
  function mostrarSlide(c, i) {
    if (!c.fotos.length) return;
    var campo = $('#notaFotoInput', modal);
    if (campo) c.fotos[estado.slide].nota = campo.value;
    var total = c.fotos.length;
    estado.slide = ((i % total) + total) % total;
    repintarFotos(c);
  }

  function htmlComentarios(lista) {
    if (!lista.length) return '<p class="empty-note">nenhum comentário ainda.</p>';
    return lista.map(function (cm) {
      return '<div class="review"><p>' + esc(cm.texto) + '</p><time>' + dataCurta(cm.data) + '</time></div>';
    }).join('');
  }

  function ligarModal(c) {
    var input = $('#comentarioInput', modal);
    var contador = $('#contador', modal);
    input.addEventListener('input', function () {
      contador.textContent = input.value.length + '/' + LIMITE_COMENTARIO;
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); enviarComentario(c.id); }
    });
  }

  /* um único ouvinte para o modal — o conteúdo é recriado a cada abertura */
  modal.addEventListener('click', async function (e) {
      var c = estado.cardAberto;
      if (!c) return;
      if (e.target.closest('[data-fechar]')) { fecharModal(); return; }

      var bolinha = e.target.closest('[data-slide]');
      if (bolinha) { mostrarSlide(c, +bolinha.dataset.slide); return; }

      var btn = e.target.closest('[data-m]');
      if (!btn) return;
      switch (btn.dataset.m) {
        case 'anterior':
          mostrarSlide(c, estado.slide - 1);
          break;
        case 'proxima':
          mostrarSlide(c, estado.slide + 1);
          break;

        case 'editarNotaFoto':
          estado.editandoFoto = true;
          repintarFotos(c);
          $('#notaFotoInput', modal).focus();
          break;
        case 'salvarNotaFoto':
          c.fotos[estado.slide].nota = $('#notaFotoInput', modal).value.trim();
          await Store.atualizar(c.id, { fotos: c.fotos });
          estado.editandoFoto = false;
          repintarFotos(c);
          toast('nota da foto guardada');
          break;
        case 'excluirNotaFoto':
          c.fotos[estado.slide].nota = '';
          await Store.atualizar(c.id, { fotos: c.fotos });
          estado.editandoFoto = false;
          repintarFotos(c);
          toast('nota da foto excluída');
          break;
        case 'cancelarNotaFoto':
          estado.editandoFoto = false;
          repintarFotos(c);
          break;

        case 'editarAnotacao':
          estado.editandoAnotacao = true;
          repintarAnotacao(c);
          $('#anotacaoInput', modal).focus();
          break;
        case 'excluirAnotacao':
          c.anotacao = '';
          await Store.atualizar(c.id, { anotacao: '' });
          estado.editandoAnotacao = false;
          repintarAnotacao(c);
          toast('anotação excluída');
          break;
        case 'cancelarAnotacao':
          estado.editandoAnotacao = false;
          repintarAnotacao(c);
          break;
        case 'curtir':
          var at = await Store.alternarCurtida(c.id);
          btn.classList.toggle('liked', at.curtido);
          btn.classList.add('beat');
          $('span', btn).textContent = at.likes;
          render();
          break;
        case 'comentar':
          $('#comentarioInput', modal).focus();
          break;
        case 'compartilhar':
          abrirCompartilhar(c.id);
          break;
        case 'fixar':
          var fixada = await Store.alternarFixado(c.id);
          if (!fixada) { toast('não consegui fixar; confira o banco'); break; }
          estado.cardAberto = fixada;
          btn.classList.toggle('preso', fixada.fixado);
          btn.title = fixada.fixado ? 'soltar do Início' : 'fixar no Início';
          toast(fixada.fixado ? 'fixada no Início' : 'solta do Início');
          render();
          break;
        case 'editar':
          editarCard(c.id);
          break;
        case 'excluir':
          if (confirm('Excluir esta criação do caderno?')) {
            await Store.excluir(c.id);
            fecharModal();
            toast('criação removida');
            render();
          }
          break;
        case 'salvarNota':
          c.anotacao = $('#anotacaoInput', modal).value.trim();
          await Store.atualizar(c.id, { anotacao: c.anotacao });
          estado.editandoAnotacao = false;
          repintarAnotacao(c);
          toast('anotação guardada');
          break;
        case 'enviarComentario':
          enviarComentario(c.id);
          break;
      }
  });

  async function enviarComentario(id) {
    var input = $('#comentarioInput', modal);
    var txt = input.value.trim();
    if (!txt) return;
    var at = await Store.comentar(id, txt);
    input.value = '';
    $('#contador', modal).textContent = '0/' + LIMITE_COMENTARIO;
    $('#listaComentarios', modal).innerHTML = htmlComentarios(at.comentarios);
    var lista = $('#listaComentarios', modal);
    lista.scrollTop = lista.scrollHeight;
    render();
  }

  function fecharModal() {
    if (overlay.hidden) return;
    overlay.hidden = true;
    estado.cardAberto = null;
    modal.innerHTML = '';
    document.body.style.overflow = '';
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }
  overlay.addEventListener('click', function (e) { if (e.target === overlay) fecharModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('#shareOverlay').hidden) fecharShare();
      else fecharModal();
      return;
    }
    /* setas passam as fotos do carrossel, menos enquanto se digita */
    if (overlay.hidden || !estado.cardAberto) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') mostrarSlide(estado.cardAberto, estado.slide - 1);
    if (e.key === 'ArrowRight') mostrarSlide(estado.cardAberto, estado.slide + 1);
  });

  /* ---------- compartilhar: stories em imagem ---------- */
  var shareOverlay = $('#shareOverlay');
  function fecharShare() { shareOverlay.hidden = true; $('#shareBox').innerHTML = ''; }
  shareOverlay.addEventListener('click', function (e) { if (e.target === shareOverlay) fecharShare(); });

  async function abrirCompartilhar(id) {
    var c = await Store.obter(id);
    if (!c) return;
    var link = location.href.split('#')[0] + '#/criacao/' + c.id;

    $('#shareBox').innerHTML =
      '<p class="block-title" style="margin-top:0">compartilhar</p>' +
      '<canvas id="storyCanvas" width="1080" height="1920"></canvas>' +
      '<div class="share-link"><input id="linkInput" readonly value="' + esc(link) + '">' +
      '<button class="mini-btn" id="copiarLink">copiar</button></div>' +
      '<div class="share-actions">' +
        '<button class="ghost-btn" id="fecharShare">fechar</button>' +
        '<button class="solid-btn" id="baixarStory">baixar imagem</button>' +
      '</div>';
    shareOverlay.hidden = false;

    await desenharStory($('#storyCanvas'), c);

    $('#fecharShare').addEventListener('click', fecharShare);
    $('#copiarLink').addEventListener('click', function () {
      var i = $('#linkInput'); i.select();
      navigator.clipboard ? navigator.clipboard.writeText(i.value) : document.execCommand('copy');
      toast('link copiado');
    });
    $('#baixarStory').addEventListener('click', function () {
      var a = document.createElement('a');
      a.download = 'karlareg-' + c.nome.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
      a.href = $('#storyCanvas').toDataURL('image/png');
      a.click();
    });
  }

  function carregarImagem(src) {
    return new Promise(function (res) {
      if (!src) return res(null);
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { res(null); };
      img.src = src;
    });
  }


  /* quebra o texto na largura dada, com reticencias na ultima linha */
  function quebrarTexto(g, texto, largura, maxLinhas) {
    var palavras = String(texto).split(/\s+/), linhas = [], atual = '';
    for (var i = 0; i < palavras.length; i++) {
      var tentativa = atual ? atual + ' ' + palavras[i] : palavras[i];
      if (g.measureText(tentativa).width > largura && atual) {
        linhas.push(atual);
        atual = palavras[i];
        if (linhas.length === maxLinhas) break;
      } else {
        atual = tentativa;
      }
    }
    if (linhas.length < maxLinhas && atual) linhas.push(atual);
    if (linhas.length === maxLinhas) {
      var ultima = linhas[maxLinhas - 1];
      while (ultima && g.measureText(ultima + '...').width > largura) {
        ultima = ultima.slice(0, -1);
      }
      var sobrou = palavras.join(' ').length > linhas.join(' ').length;
      if (sobrou) linhas[maxLinhas - 1] = ultima + '...';
    }
    return linhas;
  }

  /* desenha um retangulo arredondado com recuo para navegadores antigos */
  function bloco(g, x, y, w, h, r) {
    if (g.roundRect) { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  async function desenharStory(cv, c) {
    var g = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var AZUL = '#132A4C';

    /* papel em dot grid */
    g.fillStyle = '#EFE3CE';
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(19,42,76,.16)';
    for (var y = 40; y < H; y += 48) {
      for (var x = 40; x < W; x += 48) {
        g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
      }
    }

    /* abaixo do nome vai a descrição geral; sem ela, as tags entram no lugar */
    var cx = 90, cw = 900, r = 56;
    var pad = 60, iw = cw - pad * 2, ih = iw;
    var usaDescricao = !!c.descricao;
    var linhasTexto = [], tagsVisiveis = [], linhasTags = 0;

    if (usaDescricao) {
      g.font = '40px "Patrick Hand", cursive';
      linhasTexto = quebrarTexto(g, c.descricao, iw, 4);
    } else {
      tagsVisiveis = c.tags.slice(0, 6);
      g.font = '36px "Patrick Hand", cursive';
      var larg = 0;
      linhasTags = tagsVisiveis.length ? 1 : 0;
      tagsVisiveis.forEach(function (t) {
        var w = g.measureText(t.chave + ': ' + t.valor).width + 46;
        if (larg && larg + w > iw) { linhasTags++; larg = 0; }
        larg += w + 18;
      });
    }

    var alturaTexto = usaDescricao
      ? (linhasTexto.length ? linhasTexto.length * 54 + 12 : 0)
      : (linhasTags ? linhasTags * 78 + 10 : 0);
    var ch = pad + 30 + ih + 130 + alturaTexto + pad;
    var cy = Math.max(200, Math.round((H - ch - 270) / 2));
    g.fillStyle = 'rgba(19,42,76,.30)';
    bloco(g, cx + 20, cy + 24, cw, ch, r); g.fill();
    g.fillStyle = '#FFFFFF';
    bloco(g, cx, cy, cw, ch, r); g.fill();
    g.lineWidth = 8; g.strokeStyle = AZUL; g.stroke();

    /* fita colante */
    g.save();
    g.translate(cx + cw / 2, cy);
    g.rotate(-0.045);
    g.fillStyle = 'rgba(242,194,48,.85)';
    g.fillRect(-150, -38, 300, 76);
    g.lineWidth = 6; g.strokeStyle = AZUL;
    g.strokeRect(-150, -38, 300, 76);
    g.restore();

    /* foto */
    var ix = cx + pad, iy = cy + pad + 30;
    var img = await carregarImagem(c.foto);
    g.save();
    bloco(g, ix, iy, iw, ih, 36); g.clip();
    g.fillStyle = '#EFE3CE'; g.fillRect(ix, iy, iw, ih);
    if (img) {
      var k = Math.max(iw / img.width, ih / img.height);
      var dw = img.width * k, dh = img.height * k;
      g.drawImage(img, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh);
    }
    g.restore();
    g.lineWidth = 6; g.strokeStyle = AZUL;
    bloco(g, ix, iy, iw, ih, 36); g.stroke();

    /* nome */
    g.fillStyle = AZUL;
    g.textAlign = 'left';
    g.font = '700 92px Caveat, cursive';
    g.fillText(c.nome, ix, iy + ih + 104);

    if (usaDescricao) {
      /* descrição geral logo abaixo do nome */
      g.font = '40px "Patrick Hand", cursive';
      g.fillStyle = 'rgba(19,42,76,.82)';
      linhasTexto.forEach(function (linha, k) {
        g.fillText(linha, ix, iy + ih + 158 + k * 54);
      });
    } else {
      /* sem descrição, as tags ocupam o lugar para não ficar vazio */
      var cores = ['#7C8C7A', '#7B2E3A', '#A8C6E0', '#D5D1C8'];
      var tx = ix, ty = iy + ih + 148;
      g.font = '36px "Patrick Hand", cursive';
      g.lineWidth = 5;
      tagsVisiveis.forEach(function (t) {
        var texto = t.chave + ': ' + t.valor;
        var w = g.measureText(texto).width + 46;
        if (tx + w > ix + iw) { tx = ix; ty += 78; }
        var ci = corDe(t);
        g.fillStyle = cores[ci];
        bloco(g, tx, ty, w, 60, 18); g.fill();
        g.strokeStyle = AZUL; g.stroke();
        g.fillStyle = (ci >= 2) ? AZUL : '#FFFDF8';
        g.fillText(texto, tx + 23, ty + 42);
        tx += w + 18;
      });
    }

    /* assinatura */
    var fy = cy + ch + 90, fh = 180;
    g.fillStyle = AZUL;
    bloco(g, cx, fy, cw, fh, 44); g.fill();
    g.textAlign = 'center';
    g.fillStyle = '#FFFDF8';
    g.font = '700 92px Caveat, cursive';
    g.fillText('KarlaReg', cx + cw / 2, fy + 88);
    g.font = '700 30px Nunito, sans-serif';
    g.fillStyle = 'rgba(255,253,248,.80)';
    g.fillText('I N S T A G R A M   ·   @ K A R L A R E G', cx + cw / 2, fy + 140);
  }

  /* ---------- exemplos iniciais ---------- */
  var EXEMPLOS = [
    {
      nome: 'Vaso Bolinhas',
      arquivo: 'assets/fotos/vaso-bolinhas.jpg',
      notaFoto: 'peça inteira, luz natural',
      notaDetalhe: 'detalhe: bolinhas aplicadas à mão',
      descricao: 'Vaso cilíndrico em grês, texturizado com bolinhas aplicadas uma a uma. ' +
        'Superfície externa sem esmalte, para manter o toque da argila.',
      tags: [
        { chave: 'Cor', valor: 'bege areia', cor: 3 },
        { chave: 'Estilo', valor: 'rústico', cor: 0 },
        { chave: 'Técnica', valor: 'aplicação', cor: 0 },
        { chave: 'Forma', valor: 'cilíndrica', cor: 1 },
        { chave: 'Tamanho', valor: 'médio', cor: 2 }
      ],
      anotacao: 'Bolinhas aplicadas uma a uma com barbotina. Esmalte transparente só por dentro.',
      likes: 4,
      curtido: true,
      comentarios: [
        { texto: 'a textura ficou linda', data: Date.now() - 86400000 },
        { texto: 'perfeito para plantinha', data: Date.now() - 3600000 }
      ]
    },
    {
      nome: 'Dupla Carving',
      arquivo: 'assets/fotos/dupla-carving.webp',
      notaFoto: 'o par completo, com as flores secas',
      notaDetalhe: 'detalhe: estrias do carving',
      descricao: 'Kit de dois cilindros com estrias verticais feitas em carving. ' +
        'Esmalte laranja intenso por cima do engobe, queima alta.',
      tags: [
        { chave: 'Cor', valor: 'laranja intenso', cor: 1 },
        { chave: 'Técnica', valor: 'carving', cor: 0 },
        { chave: 'Estilo', valor: 'minimalista', cor: 2 },
        { chave: 'Esmalte', valor: 'brilhante', cor: 3 },
        { chave: 'Tamanho', valor: 'kit duplo', cor: 2 }
      ],
      anotacao: 'Estrias feitas com estecas ainda no couro. Queima alta, 1250 graus.',
      likes: 7,
      curtido: false,
      comentarios: [
        { texto: 'esse laranja é maravilhoso', data: Date.now() - 7200000 }
      ]
    }
  ];

  /* recorte central da propria foto, usado como segunda imagem dos exemplos */
  async function recorteCentral(src, zoom) {
    var img = await carregarImagem(src);
    if (!img) return '';
    var lado = Math.min(img.width, img.height) / zoom;
    var cv = document.createElement('canvas');
    cv.width = cv.height = 700;
    cv.getContext('2d').drawImage(
      img,
      (img.width - lado) / 2, (img.height - lado) / 2, lado, lado,
      0, 0, 700, 700
    );
    return cv.toDataURL('image/jpeg', 0.85);
  }

  async function semear() {
    /* os exemplos são só do modo local; no banco quem manda é o acervo real */
    if (window.KARLAREG_CONFIG && window.KARLAREG_CONFIG.supabaseUrl) return;
    if (localStorage.getItem('karlareg.semeado')) return;
    localStorage.setItem('karlareg.semeado', '1');
    var lista = await Store.listar();
    if (lista.length) return;
    for (var i = 0; i < EXEMPLOS.length; i++) {
      var ex = EXEMPLOS[i];
      var fotos = [{ src: ex.arquivo, nota: ex.notaFoto }];
      var detalhe = await recorteCentral(ex.arquivo, 2.2);
      if (detalhe) fotos.push({ src: detalhe, nota: ex.notaDetalhe });

      var nova = await Store.criar({
        nome: ex.nome, fotos: fotos, tags: ex.tags, descricao: ex.descricao
      });
      if (!nova) return;
      await Store.atualizar(nova.id, {
        anotacao: ex.anotacao,
        likes: ex.likes,
        curtido: ex.curtido,
        comentarios: ex.comentarios,
        criadoEm: Date.now() - (EXEMPLOS.length - i) * 60000
      });
    }
  }

  window.onArmazenamentoCheio = function () {
    toast('armazenamento do navegador cheio — exclua alguma criação');
  };

  /* ---------- deep link ---------- */
  function abrirPelaURL() {
    var m = location.hash.match(/#\/criacao\/(.+)$/);
    if (m) { irPara('galeria'); abrirCard(m[1]); }
  }

  /* ---------- abertura ---------- */
  (function () {
    var intro = $('#intro');
    if (!intro) return;
    var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var espera = reduzido ? 600 : 2650;
    var saiu = false;
    function sair() {
      if (saiu) return;
      saiu = true;
      intro.classList.add('saindo');
      setTimeout(function () { intro.remove(); }, 800);
    }
    intro.addEventListener('click', sair);   /* clicar pula a abertura */
    setTimeout(sair, espera);
  })();

  /* ---------- início ---------- */
  semear().then(render).then(abrirPelaURL);
})();
