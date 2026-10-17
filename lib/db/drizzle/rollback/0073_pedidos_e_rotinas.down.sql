-- Desfaz os pedidos às responsabilidades e a lista fixa.
-- O que se perde: todos os pedidos (abertos, aceitos, recusados) e quem os recebeu, e todos os itens da lista fixa
-- com a repetição e a marcação de cada um. As tarefas que nasceram de pedidos aceitos continuam existindo (elas
-- ficam na tabela tasks); só some a ligação delas com o pedido.
DROP TABLE IF EXISTS responsibility_routines;
DROP TABLE IF EXISTS responsibility_request_recipients;
DROP TABLE IF EXISTS responsibility_requests;
