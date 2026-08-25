/* ===== Camada de dados =====
   API assíncrona de propósito: quando o Supabase entrar, basta
   trocar LocalAdapter por SupabaseAdapter mantendo os mesmos métodos.

   Criacao = {
     id, nome, foto (dataURL ou url), tags:[{chave,valor}],
     anotacao, likes, curtido, comentarios:[{texto,data}], criadoEm
   }
*/
(function (global) {
  'use strict';

  var CHAVE = 'karlareg.criacoes.v1';

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var MAX_FOTOS = 6;

  /* garante que todo registro tenha os campos esperados, mesmo os antigos */
  function normalizar(c) {
    c.tags = Array.isArray(c.tags) ? c.tags : [];
    c.comentarios = Array.isArray(c.comentarios) ? c.comentarios : [];
    c.nome = c.nome || 'sem nome';

    /* modelo antigo guardava uma foto so em c.foto */
    if (!Array.isArray(c.fotos)) {
      c.fotos = c.foto ? [{ src: c.foto, nota: '' }] : [];
    }
    c.fotos = c.fotos
      .filter(function (f) { return f && f.src; })
      .slice(0, MAX_FOTOS)
      .map(function (f) { return { src: f.src, nota: f.nota || '' }; });
    c.foto = c.fotos.length ? c.fotos[0].src : '';   /* capa, usada nas figurinhas */

    c.descricao = c.descricao || '';
    c.anotacao = c.anotacao || '';
    c.fixado = !!c.fixado;
    c.likes = c.likes || 0;
    c.curtido = !!c.curtido;
    c.criadoEm = c.criadoEm || Date.now();
    return c;
  }

  var LocalAdapter = {
    _ler: function () {
      try {
        var lista = JSON.parse(localStorage.getItem(CHAVE));
        return Array.isArray(lista) ? lista.map(normalizar) : [];
      } catch (e) { return []; }
    },
    _gravar: function (lista) {
      try {
        localStorage.setItem(CHAVE, JSON.stringify(lista));
        return true;
      } catch (e) {
        /* cota do navegador estourada: as fotos ficam grandes em data URL */
        if (typeof window.onArmazenamentoCheio === 'function') window.onArmazenamentoCheio();
        return false;
      }
    },

    /* a fixada vem sempre primeiro; o resto, da mais nova para a mais antiga */
    listar: async function () {
      return this._ler().sort(function (a, b) {
        if (a.fixado !== b.fixado) return a.fixado ? -1 : 1;
        return b.criadoEm - a.criadoEm;
      });
    },

    obter: async function (id) {
      return this._ler().filter(function (c) { return c.id === id; })[0] || null;
    },

    criar: async function (dados) {
      var lista = this._ler();
      var nova = normalizar({
        id: uid(),
        nome: dados.nome || 'sem nome',
        fotos: dados.fotos || [],
        tags: dados.tags || [],
        descricao: dados.descricao || '',
        anotacao: '',
        likes: 0,
        curtido: false,
        comentarios: [],
        criadoEm: dados.criadoEm || Date.now()
      });
      lista.push(nova);
      if (!this._gravar(lista)) return null;
      return nova;
    },

    atualizar: async function (id, mudancas) {
      var lista = this._ler();
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === id) {
          Object.keys(mudancas).forEach(function (k) { lista[i][k] = mudancas[k]; });
          normalizar(lista[i]);   /* mantem a capa e as fotos consistentes */
          this._gravar(lista);
          return lista[i];
        }
      }
      return null;
    },

    excluir: async function (id) {
      this._gravar(this._ler().filter(function (c) { return c.id !== id; }));
    },

    comentar: async function (id, texto) {
      var c = await this.obter(id);
      if (!c) return null;
      c.comentarios.push({ texto: texto.slice(0, 45), data: Date.now() });
      return this.atualizar(id, { comentarios: c.comentarios });
    },

    /* fixar uma solta a anterior: só existe uma fixada por vez */
    alternarFixado: async function (id) {
      var lista = this._ler();
      var virandoFixo = !lista.some(function (c) { return c.id === id && c.fixado; });
      lista.forEach(function (c) { c.fixado = virandoFixo && c.id === id; });
      this._gravar(lista);
      return this.obter(id);
    },

    alternarCurtida: async function (id) {
      var c = await this.obter(id);
      if (!c) return null;
      var curtido = !c.curtido;
      return this.atualizar(id, {
        curtido: curtido,
        likes: Math.max(0, (c.likes || 0) + (curtido ? 1 : -1))
      });
    }
  };

  LocalAdapter.MAX_FOTOS = MAX_FOTOS;
  global.Store = LocalAdapter;
  /* fica acessível mesmo depois que o adaptador do Supabase assume,
     para conseguir migrar o que já estava guardado no navegador */
  global.StoreLocal = LocalAdapter;
})(window);
