-- Teste do módulo de comunicação interna. Uso:
--   createdb com_t && psql -d com_t -v ON_ERROR_STOP=1 -f tests/mock_supabase.sql -f supabase/schema.sql -f supabase/funcoes.sql -f supabase/comunicados.sql -f tests/comunicados_banco.sql
\set QUIET on
\pset tuples_only on
insert into auth.users(id, email) values ('a0000000-0000-0000-0000-000000000001','adm@r'),('a0000000-0000-0000-0000-000000000002','cozinha@r'),('a0000000-0000-0000-0000-000000000003','salao@r'),('a0000000-0000-0000-0000-000000000004','bar@r'),('b0000000-0000-0000-0000-000000000001','outro@r');
insert into rest_restaurantes(id, nome, codigo) values ('10000000-0000-0000-0000-000000000001','Cantinho','SABOR-TESTE'),('20000000-0000-0000-0000-000000000002','Outro','OUTRO-TESTE');
insert into rest_funcionarios(id, restaurante_id, user_id, nome, papeis, setor) values
 ('f0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Dona','{admin}','Administração'),
 ('f0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','Cozinheira','{solicitante}','Cozinha'),
 ('f0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000003','Garçom','{solicitante}','Salão'),
 ('f0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000004','Barman','{caixa}','Bar'),
 ('f0000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','Outro','{admin}',null);
create or replace function t_como(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create or replace function t_ok(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function t_erro(sql text, trecho text, msg text) returns void language plpgsql as $$
begin begin execute sql; exception when others then if sqlerrm ilike '%' || trecho || '%' then raise notice 'ok - % (%)', msg, sqlerrm; return; end if; raise exception 'FALHOU: % — erro inesperado: %', msg, sqlerrm; end; raise exception 'FALHOU: % — deveria ter dado erro', msg; end $$;
grant execute on function t_ok(boolean, text), t_como(text), t_erro(text, text, text) to authenticated;
create table t_v (k text primary key, v uuid); grant all on t_v to authenticated;

-- administração: grupo e comunicados
select t_como('a0000000-0000-0000-0000-000000000001');
insert into t_v select 'g', rest_com_grupo_salvar(null, 'Turno da noite', array['f0000000-0000-0000-0000-000000000004'::uuid]);
insert into t_v select 'c1', (rest_com_criar(jsonb_build_object('titulo', 'Novo uniforme', 'conteudo', 'A partir de segunda usar o avental novo.', 'prioridade', 'urgente', 'obrigatoria', true,
  'prazo', (now() + interval '1 day')::text, 'destino', jsonb_build_object('setores', jsonb_build_array('Cozinha'), 'grupos', jsonb_build_array((select v from t_v where k = 'g'))), 'lembrete_horas', 4))->>'id')::uuid;
select t_ok((select count(*) from rest_comunicado_dest where comunicado_id = (select v from t_v where k = 'c1')) = 2, 'destino por setor (Cozinha) + grupo (Barman) = 2 pessoas');
insert into t_v select 'c2', (rest_com_criar(jsonb_build_object('titulo', 'Reunião geral', 'conteudo', 'Sexta às 15h.', 'destino', jsonb_build_object('todos', true), 'enviar_em', (now() + interval '2 hours')::text))->>'id')::uuid;
select t_ok((select status = 'agendado' from rest_comunicados where id = (select v from t_v where k = 'c2')) and (select count(*) from rest_comunicado_dest where comunicado_id = (select v from t_v where k = 'c2')) = 0, 'agendado ainda sem destinatários');
select t_erro($$select rest_com_criar('{"titulo":"x","conteudo":"abc"}')$$, 'título', 'título curto recusado');
select t_erro($$select rest_com_criar(jsonb_build_object('titulo','Com prazo','conteudo','abc','prazo',(now() - interval '1 h')::text))$$, 'prazo', 'prazo antes do envio recusado');
select t_erro($$select rest_com_criar('{"titulo":"Anexo","conteudo":"abc","anexos":[{"path":"x"}]}')$$, 'Permitir anexos', 'anexo exige a opção permitir anexos');

-- funcionário de fora do destino não vê nem abre
select t_como('a0000000-0000-0000-0000-000000000003');
select t_ok((select count(*) from rest_comunicados) = 0, 'garçom (Salão) não vê comunicado da Cozinha nem o agendado');
select t_ok((rest_com_abrir((select v from t_v where k = 'c1')))->>'ok' = 'false', 'abertura negada para quem não é destinatário');
select t_ok((rest_com_confirmar((select v from t_v where k = 'c1'), 1))->>'ok' = 'false', 'não confirma comunicado de outro');
select t_erro($$insert into rest_comunicado_confirmacoes(comunicado_id, restaurante_id, funcionario_id, user_id, versao) values ((select v from t_v where k = 'c1'), '10000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 1)$$, 'row-level security', 'não grava confirmação em nome de outro');

-- cozinheira: entrega técnica não é leitura; confirma só depois de abrir
select t_como('a0000000-0000-0000-0000-000000000002');
select t_ok((select situacao from rest_comunicado_situacao where funcionario_id = rest_meu_funcionario()) = 'enviada', 'disponível no app, ainda não recebido');
select rest_com_sincronizar();
select rest_com_avisado(array[(select v from t_v where k = 'c1')]);
select t_ok((select situacao = 'entregue' and avisos = 1 from rest_comunicado_situacao where funcionario_id = rest_meu_funcionario()), 'recebido no app e aviso exibido NÃO contam como leitura');
select t_erro($$select rest_com_confirmar((select v from t_v where k = 'c1'), 1)$$, 'Abra e leia', 'confirmar exige abrir antes');
select rest_com_abrir((select v from t_v where k = 'c1'), 'Teste/Android');
select t_ok((select situacao from rest_comunicado_situacao where funcionario_id = rest_meu_funcionario()) = 'visualizada', 'aberta: visualizada, aguardando confirmação');
select t_ok((rest_com_confirmar((select v from t_v where k = 'c1'), 1, 'Teste/Android'))->>'ok' = 'true', 'leitura confirmada');
select t_ok((rest_com_confirmar((select v from t_v where k = 'c1'), 1))->>'ja_confirmado' = 'true', 'segunda confirmação não duplica');
select t_ok((select count(*) from rest_comunicado_confirmacoes) = 1 and (select dispositivo from rest_comunicado_confirmacoes) = 'Teste/Android', 'uma confirmação, com o aparelho');

-- edição relevante pede nova confirmação; versão anterior preservada
select t_como('a0000000-0000-0000-0000-000000000001');
select t_ok((rest_com_editar((select v from t_v where k = 'c1'), jsonb_build_object('titulo', 'Novo uniforme', 'conteudo', 'A partir de segunda usar o avental novo e touca.'), true))->>'reconfirmar' = '1', 'edição relevante pede nova confirmação a quem já confirmou');
select t_ok((select count(*) from rest_comunicado_versoes where comunicado_id = (select v from t_v where k = 'c1')) = 2 and (select conteudo from rest_comunicado_versoes where versao = 1 and comunicado_id = (select v from t_v where k = 'c1')) like '%avental novo.', 'versão anterior preservada');
select t_ok((select alteracoes from rest_comunicado_versoes where versao = 2 and comunicado_id = (select v from t_v where k = 'c1')) = '{conteúdo}', 'registra o que foi alterado');
select t_como('a0000000-0000-0000-0000-000000000002');
select t_ok((select situacao <> 'confirmada' and atualizada from rest_comunicado_situacao where funcionario_id = rest_meu_funcionario()), 'volta a pendente com indicação MENSAGEM ATUALIZADA');
select t_erro($$select rest_com_confirmar((select v from t_v where k = 'c1'), 1)$$, 'atualizado', 'não confirma a versão antiga');
select rest_com_abrir((select v from t_v where k = 'c1'));
select t_ok((rest_com_confirmar((select v from t_v where k = 'c1'), 2))->>'ok' = 'true', 'confirma a nova versão');
select t_ok((select count(*) from rest_comunicado_confirmacoes) = 2, 'duas confirmações (uma por versão) guardadas');

-- prazo vencido: status calculado pelo servidor; não confirma sozinho
reset role;
alter table rest_comunicados disable trigger user; update rest_comunicados set enviar_em = now() - interval '3 days', prazo = now() - interval '1 hour' where id = (select v from t_v where k = 'c1'); alter table rest_comunicados enable trigger user;
select t_ok((select situacao from rest_comunicado_situacao where funcionario_id = 'f0000000-0000-0000-0000-000000000004') = 'prazo_expirado', 'prazo vencido: PRAZO EXPIRADO, sem confirmação automática');
select t_ok((select situacao from rest_comunicado_situacao where funcionario_id = 'f0000000-0000-0000-0000-000000000002') = 'confirmada', 'quem confirmou continua confirmado');

-- agendado: liberado pelo horário do servidor quando alguém abre o app
alter table rest_comunicados disable trigger user; update rest_comunicados set enviar_em = now() - interval '1 minute' where id = (select v from t_v where k = 'c2'); alter table rest_comunicados enable trigger user;
select t_como('a0000000-0000-0000-0000-000000000004');
select t_ok((select count(*) from rest_comunicados where id = (select v from t_v where k = 'c2')) = 0, 'antes da liberação o Barman não vê o agendado');
select rest_com_sincronizar();
reset role;
select t_ok((select count(*) from rest_comunicado_dest where comunicado_id = (select v from t_v where k = 'c2')) = 3, 'agendado enviado para toda a equipe (3)');
select t_ok(not exists (select 1 from rest_comunicado_dest where comunicado_id = (select v from t_v where k = 'c2') and funcionario_id = 'f0000000-0000-0000-0000-000000000001'), 'quem escreveu não recebe o próprio comunicado');

-- cancelamento preserva histórico; nada é apagado
select t_como('a0000000-0000-0000-0000-000000000001');
select t_erro($$select rest_com_cancelar((select v from t_v where k = 'c2'), '')$$, 'motivo', 'cancelar exige motivo');
select t_ok((rest_com_cancelar((select v from t_v where k = 'c2'), 'Reunião adiada'))->>'ja_enviado' = 'true', 'cancelado (já enviado: avisa a equipe)');
select t_ok((select bool_and(situacao = 'cancelada') from rest_comunicado_situacao where comunicado_id = (select v from t_v where k = 'c2')), 'status CANCELADA para todos');
select t_erro($$select rest_com_editar((select v from t_v where k = 'c2'), '{"titulo":"x y z","conteudo":"abc"}', false)$$, 'cancelado', 'cancelado não pode ser editado');
reset role;
select t_erro($$delete from rest_comunicados where id = (select v from t_v where k = 'c2')$$, 'COMUNICADO_PRESERVADO', 'comunicado não pode ser excluído');
select t_erro($$update rest_comunicado_confirmacoes set versao = 9$$, 'COMUNICADO_PRESERVADO', 'confirmação não pode ser alterada');
select t_ok((select count(*) from rest_auditoria where tabela = 'rest_comunicados' and acao = 'update') >= 3, 'edições e cancelamento na auditoria');
select t_ok((select count(*) from rest_comunicado_acessos where not ok) >= 2, 'tentativas negadas registradas');

select t_como('b0000000-0000-0000-0000-000000000001');
select t_ok((select count(*) from rest_comunicados) + (select count(*) from rest_comunicado_dest) + (select count(*) from rest_comunicado_confirmacoes) = 0, 'outro restaurante não vê nada');
\echo 'COMUNICADOS: todos os testes passaram'
