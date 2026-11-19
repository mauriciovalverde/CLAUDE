# Testes de segurança do agendamento

O teste roda num bloco `do $$ ... $$` que cria usuários fictícios (2 famílias, 2 psicólogos, 1 equipe),
executa as tentativas de acesso indevido trocando o papel (`role`) e o JWT simulado, e termina com
`raise exception 'RESULTADO ...'` — isso **desfaz tudo** e devolve o relatório na mensagem de erro.

Cenários: psicólogo lendo dados de outro psicólogo; psicólogo lendo e-mail/telefone/CPF/endereço pela API;
psicólogo chamando funções de administração; família lendo dados de outra família; equipe e visitante sem login
lendo prontuário; dois pedidos para o mesmo horário.

## Resultado — 17/11/2026 (31 de 31 OK)
Agenda por data; pedido pendente; mesmo horário bloqueado para outra família; psicólogo sem acesso a
familias/perfis/cpfs/pacientes/logs e à tabela de consultas; agenda do psicólogo só com código + primeiro nome;
prontuário só do responsável e sem exclusão; outro psicólogo não lê, não escreve, não se passa pelo colega,
não mexe na agenda nem cancela/reagenda/recusa consulta alheia; família e equipe sem acesso a prontuário;
visitante sem login barrado; tentativas negadas registradas no log; fila WhatsApp/e-mail com lembretes 24 h e 2 h.

## Ouvidoria — 18/11/2026 (24 de 24 OK no banco + teste de tela)
Banco (cidadão A, cidadão B, atendente): protocolo OUV-AAAA-NNNNNN; toque duplo/reenvio devolve o mesmo protocolo;
registro sem GPS; anexo que não chegou ao servidor é recusado; B não lê protocolo, anexos, arquivos nem linha do tempo de A,
não grava na pasta de A, não abre a fila nem altera o protocolo; atendente busca, vê a foto, analisa, encaminha (com nota
interna) e responde; cidadão vê setor e resposta e não vê notas internas; complementação com PDF volta para "em análise";
visitante sem login barrado; ações do atendente no log.
Tela (Playwright, celular): foto pela câmera com Usar/Refazer/Excluir, falha de envio com relato preservado e "Tentar de
novo", PDF anexado, GPS com coordenadas e precisão, GPS negado com envio normal, duplo toque em Enviar = 1 chamada,
protocolo, perfil com selo de novidade, protocolo de outra pessoa = "não encontrado", painel da equipe.
