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

## Classificados Solidários — 20/11/2026 (30 de 30 OK no banco + teste de tela)
Banco (anunciante A, interessada B, terceira C, denunciantes D/E, equipe S): anúncio novo entra sempre "em análise"
(dono não se autoaprova, não se destaca nem se marca verificado); coordenada gravada só com 2 casas (~1 km); ninguém
anuncia em nome de outro; validade máxima 180 dias; B não vê anúncio pendente nem código de cupom; B não modera;
cupom mostra o código e conta 1 uso por pessoa (repetir não gasta), limite atingido bloqueia C; B não edita nem apaga
anúncio de A; C não lê nem escreve na conversa A↔B; A vê só o primeiro nome de B e recebe aviso de mensagem;
editar anúncio publicado volta para análise; 3 denúncias suspendem o anúncio, que some da vitrine e o dono não
consegue tirar da suspensão; visitante sem login barrado; moderação registrada no log e tentativas negadas registradas.
Tela (Playwright, celular e computador): vitrine com busca, categorias, cidade, distância por GPS, preço e filtros;
detalhe com conversa pelo app, WhatsApp e denúncia; cupom revelado; publicação em 4 etapas com fotos, validação,
autorização do WhatsApp e prévia; meus anúncios com motivo da recusa; conversa; painel de moderação.
