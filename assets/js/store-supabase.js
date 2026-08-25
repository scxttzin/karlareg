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

  /* sobe o que ainda é data URL e devolve a lista com URLs públicas.
     Os envios vão todos juntos: em série, cada foto custava uma ida e volta. */
  async function subirFotos(criacaoId, fotos) {
    var carimbo = Date.now();
    return Promise.all(fotos.slice(0, MAX_FOTOS).map(async function (f, i) {
      if (!f || !f.src) return null;
      if (!ehDataUrl(f.src)) return { src: f.src, nota: f.nota || '' };

      var blob = dataUrlParaBlob(f.src);
      var ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      var caminho = criacaoId + '/' + carimbo + '-' + i + '.' + ext;

      var envio = await db.storage.from(BUCKET).upload(caminho, blob, {
        contentType: blob.type, upsert: true
      });
      if (envio.error) throw envio.error;

      return {
        src: db.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl,
        nota: f.nota || ''
      };
    })).then(function (lista) {
      return lista.filter(Boolean);
    });
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
      fixado: !!linha.fixado,
      criadoEm: new Date(linha.criado_em).getTime()
    };
  }

  var SELECT = '*, fotos(*), tags(*), comentarios(*), curtidas(sessao)';

  /* ---------- grava tags e fotos de uma criação ----------
     Em criação nova (novo = true) não há o que apagar antes, e as duas
     tabelas são gravadas ao mesmo tempo em vez de uma esperar a outra. */
  async function regravarFilhos(id, dados, novo) {
    var tarefas = [];

    if (dados.tags) {
      tarefas.push((async function () {
        if (!novo) {
          var apaga = await db.from('tags').delete().eq('criacao_id', id);
          if (apaga.error) throw apaga.error;
        }
        if (!dados.tags.length) return;
        var ins = await db.from('tags').insert(dados.tags.map(function (t) {
          return { criacao_id: id, chave: t.chave, valor: t.valor, cor: t.cor || 0 };
        }));
        if (ins.error) throw ins.error;
      })());
    }

    if (dados.fotos) {
      tarefas.push((async function () {
        var fotos = await subirFotos(id, dados.fotos);
        if (!novo) {
          var apaga = await db.from('fotos').delete().eq('criacao_id', id);
          if (apaga.error) throw apaga.error;
        }
        if (!fotos.length) return;
        var ins = await db.from('fotos').insert(fotos.map(function (f, i) {
          return { criacao_id: id, ordem: i, url: f.src, nota: f.nota };
        }));
        if (ins.error) throw ins.error;
      })());
    }

    await Promise.all(tarefas);
  }

  var SupabaseAdapter = {
    MAX_FOTOS: MAX_FOTOS,

    listar: async function () {
      var eu = sessao();
      var r = await db.from('criacoes').select(SELECT).order('criado_em', { ascending: false });
      if (r.error) { console.error(r.error); return []; }
      /* a ordenação da fixada é feita aqui, e não no banco, para o site
         continuar funcionando mesmo antes de a coluna existir */
      return r.data.map(function (l) { return montar(l, eu); })
        .sort(function (a, b) { return (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0); });
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

        await regravarFilhos(r.data.id, dados, true);
        /* sem reler do banco: quem chama já vai atualizar a tela em seguida */
        return { id: r.data.id, nome: r.data.nome };
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

    /* uma fixada por vez: solta a anterior antes de prender a nova */
    alternarFixado: async function (id) {
      var atual = await this.obter(id);
      if (!atual) return null;
      var ligar = !atual.fixado;

      var solta = await db.from('criacoes').update({ fixado: false }).eq('fixado', true);
      if (solta.error) {
        console.error(solta.error);
        if (typeof global.onErroBanco === 'function') global.onErroBanco(solta.error);
        return null;
      }
      if (ligar) {
        var prende = await db.from('criacoes').update({ fixado: true }).eq('id', id);
        if (prende.error) {
          console.error(prende.error);
          if (typeof global.onErroBanco === 'function') global.onErroBanco(prende.error);
          return null;
        }
      }
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
