/* ===== Adaptador Supabase =====
   Mesma interface do Store local: listar, obter, criar, atualizar,
   excluir, comentar e alternarCurtida. Se a configuração estiver vazia,
   este arquivo não faz nada e o caderno segue no localStorage.
*/
(function (global) {
  'use strict';

  var cfg = global.KARLAREG_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;
  if (!global.supabase || !global.supabase.createClient) {
    console.warn('supabase-js não carregou; o caderno segue no navegador.');
    return;
  }

  var db = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  var BUCKET = cfg.bucketFotos || 'criacoes';
  var MAX_FOTOS = 6;

  /* identifica o visitante só para não deixar ele curtir duas vezes */
  function sessao() {
    var s = localStorage.getItem('karlareg.sessao');
    if (!s) {
      s = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
      localStorage.setItem('karlareg.sessao', s);
    }
    return s;
  }

  /* ---------- fotos ---------- */
  function ehDataUrl(src) { return /^data:/.test(src); }

  function dataUrlParaBlob(dataUrl) {
    var partes = dataUrl.split(',');
    var tipo = (partes[0].match(/:(.*?);/) || [null, 'image/jpeg'])[1];
    var bin = atob(partes[1]);
    var buf = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return new Blob([buf], { type: tipo });
  }

  /* sobe o que ainda é data URL e devolve a lista com URLs públicas */
  async function subirFotos(criacaoId, fotos) {
    var prontas = [];
    for (var i = 0; i < fotos.length && i < MAX_FOTOS; i++) {
      var f = fotos[i];
      if (!f || !f.src) continue;
      if (!ehDataUrl(f.src)) { prontas.push({ src: f.src, nota: f.nota || '' }); continue; }

      var blob = dataUrlParaBlob(f.src);
      var ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      var caminho = criacaoId + '/' + Date.now() + '-' + i + '.' + ext;

      var envio = await db.storage.from(BUCKET).upload(caminho, blob, {
        contentType: blob.type, upsert: true
      });
      if (envio.error) throw envio.error;

      var publica = db.storage.from(BUCKET).getPublicUrl(caminho);
      prontas.push({ src: publica.data.publicUrl, nota: f.nota || '' });
    }
    return prontas;
  }

  /* ---------- conversão banco -> formato do caderno ---------- */
  function montar(linha, curtidasDoVisitante) {
    var fotos = (linha.fotos || [])
      .slice()
      .sort(function (a, b) { return a.ordem - b.ordem; })
      .map(function (f) { return { src: f.url, nota: f.nota || '' }; });

    return {
      id: linha.id,
      nome: linha.nome,
      descricao: linha.descricao || '',
      anotacao: linha.anotacao || '',
      fotos: fotos,
      foto: fotos.length ? fotos[0].src : '',
      tags: (linha.tags || []).map(function (t) {
        return { chave: t.chave, valor: t.valor, cor: t.cor };
      }),
      comentarios: (linha.comentarios || [])
        .slice()
        .sort(function (a, b) { return new Date(a.criado_em) - new Date(b.criado_em); })
        .map(function (m) { return { texto: m.texto, data: new Date(m.criado_em).getTime() }; }),
      likes: (linha.curtidas || []).length,
      curtido: (linha.curtidas || []).some(function (k) { return k.sessao === curtidasDoVisitante; }),
      criadoEm: new Date(linha.criado_em).getTime()
    };
  }

  var SELECT = '*, fotos(*), tags(*), comentarios(*), curtidas(sessao)';

  /* ---------- grava tags e fotos de uma criação ---------- */
  async function regravarFilhos(id, dados) {
    if (dados.tags) {
      var apagaTags = await db.from('tags').delete().eq('criacao_id', id);
      if (apagaTags.error) throw apagaTags.error;
      if (dados.tags.length) {
        var insTags = await db.from('tags').insert(dados.tags.map(function (t) {
          return { criacao_id: id, chave: t.chave, valor: t.valor, cor: t.cor || 0 };
        }));
        if (insTags.error) throw insTags.error;
      }
    }
    if (dados.fotos) {
      var fotos = await subirFotos(id, dados.fotos);
      var apagaFotos = await db.from('fotos').delete().eq('criacao_id', id);
      if (apagaFotos.error) throw apagaFotos.error;
      if (fotos.length) {
        var insFotos = await db.from('fotos').insert(fotos.map(function (f, i) {
          return { criacao_id: id, ordem: i, url: f.src, nota: f.nota };
        }));
        if (insFotos.error) throw insFotos.error;
      }
    }
  }

  var SupabaseAdapter = {
    MAX_FOTOS: MAX_FOTOS,

    listar: async function () {
      var eu = sessao();
      var r = await db.from('criacoes').select(SELECT).order('criado_em', { ascending: false });
      if (r.error) { console.error(r.error); return []; }
      return r.data.map(function (l) { return montar(l, eu); });
    },

    obter: async function (id) {
      var r = await db.from('criacoes').select(SELECT).eq('id', id).maybeSingle();
      if (r.error || !r.data) return null;
      return montar(r.data, sessao());
    },

    criar: async function (dados) {
      try {
        var r = await db.from('criacoes').insert({
          nome: dados.nome || 'sem nome',
          descricao: dados.descricao || '',
          anotacao: '',
          criado_em: new Date(dados.criadoEm || Date.now()).toISOString()
        }).select().single();
        if (r.error) throw r.error;

        await regravarFilhos(r.data.id, dados);
        return this.obter(r.data.id);
      } catch (e) {
        console.error(e);
        if (typeof global.onErroBanco === 'function') global.onErroBanco(e);
        return null;
      }
    },

    atualizar: async function (id, mudancas) {
      try {
        var campos = {};
        if ('nome' in mudancas) campos.nome = mudancas.nome;
        if ('descricao' in mudancas) campos.descricao = mudancas.descricao;
        if ('anotacao' in mudancas) campos.anotacao = mudancas.anotacao;
        if ('criadoEm' in mudancas) campos.criado_em = new Date(mudancas.criadoEm).toISOString();

        if (Object.keys(campos).length) {
          var r = await db.from('criacoes').update(campos).eq('id', id);
          if (r.error) throw r.error;
        }
        await regravarFilhos(id, mudancas);
        return this.obter(id);
      } catch (e) {
        console.error(e);
        if (typeof global.onErroBanco === 'function') global.onErroBanco(e);
        return null;
      }
    },

    excluir: async function (id) {
      var r = await db.from('criacoes').delete().eq('id', id);
      if (r.error) console.error(r.error);
    },

    comentar: async function (id, texto) {
      var r = await db.from('comentarios')
        .insert({ criacao_id: id, texto: String(texto).slice(0, 45) });
      if (r.error) console.error(r.error);
      return this.obter(id);
    },

    alternarCurtida: async function (id) {
      var eu = sessao();
      var jaTem = await db.from('curtidas')
        .select('sessao').eq('criacao_id', id).eq('sessao', eu).maybeSingle();

      if (jaTem.data) {
        await db.from('curtidas').delete().eq('criacao_id', id).eq('sessao', eu);
      } else {
        await db.from('curtidas').insert({ criacao_id: id, sessao: eu });
      }
      return this.obter(id);
    }
  };

  /* ---------- sessão da dona do caderno ---------- */
  SupabaseAdapter.auth = {
    atual: async function () {
      var s = await db.auth.getSession();
      return (s.data && s.data.session) ? s.data.session.user : null;
    },
    entrar: async function (email, senha) {
      var r = await db.auth.signInWithPassword({ email: email, password: senha });
      return { usuario: r.data ? r.data.user : null, erro: r.error };
    },
    sair: async function () { await db.auth.signOut(); },
    aoMudar: function (cb) {
      db.auth.onAuthStateChange(function (_evento, sessao) {
        cb(sessao ? sessao.user : null);
      });
    }
  };

  global.Store = SupabaseAdapter;
  console.info('KarlaReg conectado ao Supabase.');
})(window);
