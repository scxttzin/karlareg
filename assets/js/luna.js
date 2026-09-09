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
  var MARCA = '#F7E3A4';

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
    campoData.textContent = d.getDate() + ' de ' + MESES[d.getMonth()] + '.';
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
  function marcado() {
    var cor = '';
    try { cor = document.queryCommandValue('hiliteColor') || ''; } catch (e) {}
    if (!cor || cor === 'transparent') {
      try { cor = document.queryCommandValue('backColor') || ''; } catch (e) {}
    }
    return /247,\s*227,\s*164/.test(cor) || cor.toLowerCase() === MARCA.toLowerCase();
  }

  /* mousedown com preventDefault: sem isso o clique tira a seleção do texto
     antes de o comando rodar, e a formatação não pega em nada */
  barra.addEventListener('mousedown', function (e) {
    if (e.target.closest('button')) e.preventDefault();
  });

  barra.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    comando(b.dataset.cmd);
    pintarBarra();
    guardar();
  });

  /* acende o botão do que está valendo onde o cursor está */
  function pintarBarra() {
    Array.prototype.forEach.call(barra.querySelectorAll('button'), function (b) {
      var cmd = b.dataset.cmd, ligado = false;
      if (cmd === 'marca') {
        ligado = marcado();
      } else if (cmd !== 'removeFormat') {
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
    if (k === 'h' && e.shiftKey) { e.preventDefault(); comando('marca'); pintarBarra(); guardar(); }
    if (k === 'x' && e.shiftKey) { e.preventDefault(); comando('strikeThrough'); pintarBarra(); guardar(); }
  });

  /* Esc devolve o foco ao caderno, para as teclas do carrossel voltarem */
  texto.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') texto.blur();
  });
})();
