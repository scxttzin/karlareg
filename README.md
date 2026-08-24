# KarlaReg — Caderno de Criações

Banco de dados interativo de criações em cerâmica, com interface de caderno.

## Rodar no localhost

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Depois abra `http://localhost:5173/`. A porta pode ser trocada: `-Port 8080`.

## Estrutura

```
index.html            marcação das duas folhas (Início e Galeria)
assets/css/style.css  papel pautado, figurinhas, liquid glass, modal
assets/js/store.js    camada de dados (hoje localStorage)
assets/js/app.js      interface: folhas, cards, tags, avaliações, stories
serve.ps1             servidor estático local
```

## O que já funciona

- Duas abas em folha de caderno, com virada de página em 3D.
- Início: campo de busca por nome ou tag, card animado de nova criação com foto
  e tags digitadas livremente (chave + valor), criações coladas como figurinhas.
- Galeria: grade rolável, busca em liquid glass fixa no topo que perde a
  transparência ao passar o mouse ou ao digitar.
- Card aberto: fundo desfocado, listagem de tags, anotação em quadro branco com
  letra manuscrita, chat de avaliações (máximo de 45 caracteres por comentário).
- Curtir, compartilhar e comentar direto no card fechado; o ícone de comentário
  abre o card completo.
- Compartilhar gera a imagem em formato stories (1080x1920) para download, com a
  assinatura KarlaReg e o direcionamento para o Instagram, mais um link direto
  para a criação (`#/criacao/<id>`), que abre o card ao ser acessado.
- Lápis edita nome, foto e tags; lixeira exclui a criação.

## Paleta

| uso | cor |
| --- | --- |
| branco | `#FFFDF8` |
| bege | `#EFE3CE` |
| amarelo | `#F2C230` |
| azul escuro | `#132A4C` |
| tag verde cinza | `#7C8C7A` |
| tag vermelho vinho | `#7B2E3A` |
| tag azul claro | `#A8C6E0` |
| tag cinza claro | `#D5D1C8` |

## Próximo passo: Supabase

Todo o acesso a dados passa por `window.Store` (`assets/js/store.js`), com os
métodos `listar`, `obter`, `criar`, `atualizar`, `excluir`, `comentar` e
`alternarCurtida` — todos assíncronos. Para migrar, basta escrever um
`SupabaseAdapter` com a mesma assinatura e trocar a atribuição final do arquivo.

Esboço de esquema:

- `criacoes` — `id uuid`, `nome text`, `foto_url text`, `tags jsonb`,
  `anotacao text`, `criado_em timestamptz`
- `comentarios` — `id uuid`, `criacao_id uuid`, `texto text (<= 45)`,
  `criado_em timestamptz`
- `curtidas` — `criacao_id uuid`, `sessao text`, `criado_em timestamptz`

As fotos, hoje guardadas como data URL no `localStorage`, passam para o Supabase
Storage e o campo vira apenas a URL pública.

## Referências de layout

As imagens em `Layout Ideals/` guiaram o acabamento visual, sem alterar a ideia
descrita no prompt:

- fichário azul escuro envolvendo a folha, com abas verticais arredondadas à
  direita (bege para inativa, azul claro para a seguinte, azul escuro na ativa);
- página em dot grid, com cabeçalho em caixa fina de letras maiúsculas espaçadas
  e rodapé curto no mesmo tratamento;
- cards, tags e botões com contorno grosso azul escuro e sombra sólida deslocada;
- quadro de anotação como cartão amarelo com campo branco interno;
- trio de contadores (criações, curtidas, avaliações) ao lado da busca do Início.

## Exemplos iniciais

No primeiro carregamento o caderno é semeado com duas criações de exemplo, usando
as fotos em `assets/fotos/`. A semente só roda uma vez (marcador
`karlareg.semeado` no `localStorage`), então excluir os exemplos não os traz de
volta. Para começar do zero, limpe o `localStorage` do site.

## Início e Galeria

- **Início**: apenas o card quadrado de nova criação e, ao lado, as duas criações
  mais recentes, que giram conforme novas são coladas.
- **Galeria**: todas as criações, com o campo de busca em liquid glass fixo no
  topo, sem título de página.

## Nota técnica: cliques dentro da folha

`transform-style: preserve-3d` fica apenas em `.pages`. Se ele também for
aplicado em `.sheet`, o Chrome deixa de fazer hit-test nos filhos da folha: o
clique chega no contêiner de rolagem e nenhum botão dentro da página funciona.
A folha gira como um plano chapado, o que é exatamente o efeito desejado.

## Modelo de uma criação

```
{
  id, nome, criadoEm,
  fotos: [{ src, nota }]   // até 6; a primeira é a capa das figurinhas
  foto,                    // capa derivada, mantida para compatibilidade
  tags: [{ chave, valor, cor }]   // cor 0..3 = verde cinza, vinho, azul claro, cinza claro
  descricao,               // descrição geral, escrita na criação
  anotacao,                // quadro branco manuscrito do card aberto
  likes, curtido, comentarios: [{ texto, data }]
}
```

Registros do formato antigo (uma `foto` só, tags sem `cor`) são convertidos na
leitura pelo `normalizar()` do Store, sem perder nada.

No Supabase isso vira uma tabela `fotos` (`criacao_id`, `ordem`, `url`, `nota`)
com as imagens no Storage, e `cor` como coluna inteira em `tags`.

## Fonte Babydoll

As notas das fotos usam a Babydoll (dafont.com/pt/babydoll.font). O arquivo da
fonte não é distribuído aqui: baixe e salve como `assets/fontes/babydoll.ttf`
(ou `.woff2`, que carrega mais rápido). O `@font-face` já está no CSS — assim que
o arquivo existir, a letra troca sozinha. Sem ele, vale a alternativa
Gochi Hand, que já vem do Google Fonts.

A anotação do card continua na Caveat, para as duas caligrafias ficarem
distintas.

## Abertura

Ao carregar, o nome KarlaReg é escrito letra por letra (contorno em SVG com
`stroke-dashoffset`, depois o preenchimento), seguido do traço amarelo e do
subtítulo. Dura cerca de 3 segundos, pode ser pulada com um clique e é reduzida
a quase nada para quem usa `prefers-reduced-motion`.

## Data da criação

O formulário tem um campo `input[type=date]` — o clique abre o calendário nativo
do navegador. Em criação nova ele já vem com a data de hoje; ao editar, carrega a
data da peça e permite trocá-la. O valor é gravado ao meio-dia local, para a data
não escorregar um dia por causa do fuso.

## Layout em celular

Abaixo de 600px o fichário muda de forma: as abas viram uma fileira horizontal
na faixa de cima da capa e a folha passa a ocupar a largura inteira da tela — na
lateral elas custavam 78px de papel. Junto com isso:

- formulário em coluna única (nome, data, tags e descrição empilhados);
- figurinhas sem inclinação e com sombra menor, que era o que fazia elas vazarem
  para fora da folha;
- galeria em duas colunas;
- card aberto com as setas do carrossel dentro da foto e tudo em coluna única;
- caixa de compartilhar com os botões empilhados.

## Banco de dados (Supabase)

Projeto **KarlaReg**, região São Paulo — `gmwoffyzcqtmzctldizw`.

- [banco/schema.sql](banco/schema.sql) — tabelas, índices, gatilho, bucket e políticas. Rodar uma vez.
- [banco/acesso-aberto.sql](banco/acesso-aberto.sql) — modo atual: qualquer visitante cria, edita e exclui.
- [banco/acesso-protegido.sql](banco/acesso-protegido.sql) — fecha a escrita para quem estiver logada.
- [assets/js/config.js](assets/js/config.js) — URL e chave publicável. Vazio = volta a guardar no navegador.
- [assets/js/store-supabase.js](assets/js/store-supabase.js) — adaptador com a mesma interface do Store local.

As fotos vão para o bucket `criacoes` no Storage; o banco guarda só a URL pública.
A chave `sb_publishable_…` é feita para aparecer no código do site; a chave secreta
(`service_role`) não está no projeto e não deve entrar.
