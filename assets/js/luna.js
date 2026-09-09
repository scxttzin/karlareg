/* ===== Luna Notes =====
   Bloco de notas ao lado do caderno, no espírito do Notes do iPhone:
   negrito, itálico, riscado, marca-texto e tópicos. O conteúdo fica no
   navegador (localStorage) e é gravado sozinho, meio segundo depois da
   última tecla.
*/
(function () {
  'use strict';

  var texto = document.getElementById('lunaTexto');
  if (!texto) return;

  var barra = document.getElementById('lunaBarra');
  var status = document.getElementById('lunaStatus');
  var campoData = document.getElementById('lunaData');
  var CHAVE = 'karlareg.luna';
  var CHAVE_COR = 'karlareg.luna.cor';

  /* cores do marca-texto; a escolhida fica guardada de uma vez para a outra */
  var paleta = document.getElementById('lunaCores');
  var CORES = Array.prototype.map.call(
    paleta.querySelectorAll('.cor-marca'), function (b) { return b.dataset.cor; });
  var MARCA = localStorage.getItem(CHAVE_COR);
  if (CORES.indexOf(MARCA) < 0) MARCA = CORES[0];

  function acenderPaleta() {
    Array.prototype.forEach.call(paleta.querySelectorAll('.cor-marca'), function (b) {
      b.classList.toggle('is-on', b.dataset.cor === MARCA);
    });
  }
  acenderPaleta();

  /* rgb(...) que o navegador devolve, para saber se o trecho já está marcado */
  function comoRgb(hex) {
    return 'rgb(' + parseInt(hex.slice(1, 3), 16) + ', ' +
                    parseInt(hex.slice(3, 5), 16) + ', ' +
                    parseInt(hex.slice(5, 7), 16) + ')';
  }

  /* ---------- guardar e ler ---------- */
  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); }
    catch (e) { return null; }
  }

  var guardando;
  function guardar() {
    clearTimeout(guardando);
    guardando = setTimeout(function () {
      try {
        localStorage.setItem(CHAVE, JSON.stringify({
          html: texto.innerHTML,
          em: Date.now()
        }));
        marcarData(Date.now());
        aviso('guardado');
      } catch (e) {
        aviso('não coube no navegador');
      }
    }, 500);
  }

  var avisoTimer;
  function aviso(msg) {
    status.textContent = msg;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { status.textContent = ''; }, 1800);
  }

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
               'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  function marcarData(quando) {
    var d = new Date(quando);
    campoData.textContent = 'última anotação em ' + d.getDate() + ' de ' + MESES[d.getMonth()] + '.';
  }

  var guardado = ler();
  if (guardado && guardado.html) {
    texto.innerHTML = guardado.html;
    marcarData(guardado.em || Date.now());
  } else {
    marcarData(Date.now());
  }

  /* ---------- formatação ----------
     execCommand é antigo, mas é o único caminho que funciona em todos os
     navegadores sem escrever um editor inteiro. */
  function comando(nome) {
    texto.focus();
    if (nome === 'marca') {
      document.execCommand('styleWithCSS', false, true);
      document.execCommand('hiliteColor', false, marcado() ? 'transparent' : MARCA);
      document.execCommand('styleWithCSS', false, false);
      return;
    }
    document.execCommand(nome, false, null);
  }

  /* o navegador devolve a cor de fundo do trecho selecionado em rgb() */
  function corDoTrecho() {
    var cor = '';
    try { cor = document.queryCommandValue('hiliteColor') || ''; } catch (e) {}
    if (!cor || cor === 'transparent') {
      try { cor = document.queryCommandValue('backColor') || ''; } catch (e) {}
    }
    return cor.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /* marcado com a cor escolhida agora: só aí o botão desliga o destaque */
  function marcado() {
    var cor = corDoTrecho();
    return cor === comoRgb(MARCA).toLowerCase() || cor === MARCA.toLowerCase();
  }

  /* ---------- paleta: só aparece pelo botão do marca-texto ---------- */
  var botaoMarca = document.getElementById('lunaMarca');

  function abrirPaleta(abrir) {
    paleta.hidden = !abrir;
    botaoMarca.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    botaoMarca.classList.toggle('is-on', abrir);
  }

  /* pinta o trecho escolhido; cor vazia tira o destaque */
  function aplicarMarca(cor) {
    texto.focus();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, cor || 'transparent');
    document.execCommand('styleWithCSS', false, false);
    guardar();
  }

  paleta.addEventListener('mousedown', function (e) {
    if (e.target.closest('.cor-marca')) e.preventDefault();
  });
  paleta.addEventListener('click', function (e) {
    var b = e.target.closest('.cor-marca');
    if (!b) return;
    if (b.dataset.cor) {
      MARCA = b.dataset.cor;
      try { localStorage.setItem(CHAVE_COR, MARCA); } catch (err) {}
      acenderPaleta();
    }
    aplicarMarca(b.dataset.cor);
    abrirPaleta(false);
  });

  /* mousedown com preventDefault: sem isso o clique tira a seleção do texto
     antes de o comando rodar, e a formatação não pega em nada */
  barra.addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) e.preventDefault();
  });

  barra.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.closest('.luna-cores')) return;
    if (b.dataset.cmd === 'marca') {
      abrirPaleta(paleta.hidden);
      return;
    }
    abrirPaleta(false);
    comando(b.dataset.cmd);
    pintarBarra();
    guardar();
  });

  /* clique fora e Esc fecham a paleta */
  document.addEventListener('mousedown', function (e) {
    if (paleta.hidden) return;
    if (!e.target.closest('.luna-marca-grupo')) abrirPaleta(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !paleta.hidden) abrirPaleta(false);
  });

  /* acende o botão do que está valendo onde o cursor está */
  function pintarBarra() {
    Array.prototype.forEach.call(barra.querySelectorAll('button'), function (b) {
      var cmd = b.dataset.cmd, ligado = false;
      if (cmd === 'marca') {
        ligado = marcado() || !paleta.hidden;
      } else if (cmd && cmd !== 'removeFormat') {
        try { ligado = document.queryCommandState(cmd); } catch (e) {}
      }
      b.classList.toggle('is-on', !!ligado);
    });
  }

  document.addEventListener('selectionchange', function () {
    if (document.activeElement === texto) pintarBarra();
  });

  /* ---------- digitação ---------- */
  texto.addEventListener('input', guardar);
  texto.addEventListener('blur', guardar);

  /* colar entra como texto puro, para não trazer a formatação de fora */
  texto.addEventListener('paste', function (e) {
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });

  /* atalhos do Notes: negrito, itálico e o marca-texto no Ctrl+Shift+H */
  texto.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    var k = e.key.toLowerCase();
    if (k === 'h' && e.shiftKey) { e.preventDefault(); aplicarMarca(marcado() ? '' : MARCA); pintarBarra(); }
    if (k === 'x' && e.shiftKey) { e.preventDefault(); comando('strikeThrough'); pintarBarra(); guardar(); }
  });

  /* Esc devolve o foco ao caderno, para as teclas do carrossel voltarem */
  texto.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') texto.blur();
  });
})();
