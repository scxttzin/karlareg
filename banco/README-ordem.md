# Ordem das criações

`criado_em` guarda o **dia escolhido no formulário** com a **hora do momento
em que a criação foi colada**. O dia é o que aparece no card; a hora existe só
para desempatar duas criações do mesmo dia — sem ela, tudo criado no mesmo dia
ficava com o mesmo instante (meio-dia) e o banco devolvia em ordem arbitrária.

Editar uma criação não muda `criado_em`, a não ser que você troque a data no
formulário. Assim uma edição não faz a peça pular para o topo das recentes.
