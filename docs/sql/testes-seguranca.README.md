# Testes de segurança do agendamento

O teste roda num bloco `do $$ ... $$` que cria usuários fictícios (2 famílias, 2 psicólogos, 1 equipe),
executa as tentativas de acesso indevido trocando o papel (`role`) e o JWT simulado, e termina com
`raise exception 'RESULTADO ...'` — isso **desfaz tudo** e devolve o relatório na mensagem de erro.

Cenários: psicólogo lendo dados de outro psicólogo; psicólogo lendo e-mail/telefone/CPF/endereço pela API;
psicólogo chamando funções de administração; família lendo dados de outra família; equipe e visitante sem login
lendo prontuário; dois pedidos para o mesmo horário.
