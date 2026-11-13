-- Teste do módulo de ponto no banco. Uso:
--   createdb ponto_t && psql -d ponto_t -v ON_ERROR_STOP=1 -f tests/mock_supabase.sql -f supabase/schema.sql -f supabase/funcoes.sql -f supabase/ponto.sql -f tests/ponto_banco.sql
\set QUIET on
\pset tuples_only on
insert into auth.users(id, email) values ('a0000000-0000-0000-0000-000000000001', 'admin@r'), ('a0000000-0000-0000-0000-000000000002', 'func@r'), ('b0000000-0000-0000-0000-000000000001', 'outro@r');
insert into rest_restaurantes(id, nome, codigo) values ('10000000-0000-0000-0000-000000000001', 'Cantinho', 'SABOR-TESTE'), ('20000000-0000-0000-0000-000000000002', 'Outro', 'OUTRO-TESTE');
insert into rest_funcionarios(id, restaurante_id, user_id, nome, papeis) values
 ('f0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Dono', '{admin}'),
 ('f0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Cozinheira', '{solicitante}'),
 ('f0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Outro dono', '{admin}');
create or replace function t_como(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); execute 'set role authenticated'; end $$;
create or replace function t_ok(cond boolean, msg text) returns void language plpgsql as $$ begin if not coalesce(cond, false) then raise exception 'FALHOU: %', msg; end if; raise notice 'ok - %', msg; end $$;
create or replace function t_erro(sql text, trecho text, msg text) returns void language plpgsql as $$
begin begin execute sql; exception when others then if sqlerrm ilike '%' || trecho || '%' then raise notice 'ok - % (%)', msg, sqlerrm; return; end if; raise exception 'FALHOU: % — erro inesperado: %', msg, sqlerrm; end; raise exception 'FALHOU: % — deveria ter dado erro', msg; end $$;
grant execute on function t_ok(boolean, text), t_como(text), t_erro(text, text, text) to authenticated;
create table t_v (k text primary key, v text); grant all on t_v to authenticated;
select set_config('t.desc', (select string_agg('0.1', ',') from generate_series(1, 128)), false);

-- administrador: ficha, local (raio 100 m), jornada começando AGORA (entrada = hora local atual), biometria
select t_como('a0000000-0000-0000-0000-000000000001');
insert into rest_func_ficha(funcionario_id, nome_completo, cpf, pis, cargo, cbo, data_admissao, salario) values ('f0000000-0000-0000-0000-000000000002', 'Maria da Silva', '123.456.789-09', '120.12345.67-8', 'Cozinheira', '5132-05', '2026-01-10', 2100);
insert into rest_ponto_locais(id, nome, lat, lng, raio_m) values ('c0000000-0000-0000-0000-000000000001', 'Restaurante', -23.55, -46.63, 100);
do $$ declare e time := date_trunc('minute', (now() at time zone 'America/Sao_Paulo')::time); d jsonb := '{}';
begin
  for i in 1..7 loop d := d || jsonb_build_object(i::text, jsonb_build_object('entrada', to_char(e, 'HH24:MI'), 'int_ini', to_char(e + interval '4 h', 'HH24:MI'), 'int_fim', to_char(e + interval '5 h', 'HH24:MI'), 'saida', to_char(e + interval '9 h', 'HH24:MI'))); end loop;
  insert into rest_ponto_jornadas(funcionario_id, valido_desde, semana) values ('f0000000-0000-0000-0000-000000000002', current_date - 1, d);
end $$;
select t_ok((select count(*) from rest_ponto_jornadas) = 1, 'admin cadastra jornada individual');

-- empregado
select t_como('a0000000-0000-0000-0000-000000000002');
select t_ok((select cpf from rest_func_ficha) = '123.456.789-09', 'empregado vê a própria ficha');
select t_erro($$update rest_func_ficha set salario = 9999$$, '', 'empregado não altera a ficha') where false; -- RLS: update sem efeito
update rest_func_ficha set salario = 9999; select t_ok((select salario from rest_func_ficha) = 2100, 'empregado não altera a ficha (RLS)');
select rest_ponto_cadastrar_rosto(null, string_to_array(current_setting('t.desc'), ',')::float8[], 'x/selfie.jpg', 'v1');
select t_erro($$select rest_ponto_cadastrar_rosto(null, string_to_array(current_setting('t.desc'), ',')::float8[], 'y', 'v1')$$, 'já está cadastrado', 'segundo cadastro de rosto só pelo admin');
select t_erro($$insert into rest_ponto_marcacoes(restaurante_id, funcionario_id, nsr, tipo, data_ref, horario, hash) values ('10000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000002', 99, 'entrada', current_date, now(), 'x')$$, 'row-level security', 'empregado não insere marcação direto na tabela');

-- 1) ENTRADA dentro da janela, no local, rosto confere → aprovada automaticamente
insert into t_v select 'e', rest_ponto_registrar('{"lat": -23.5502, "lng": -46.6301, "precisao": 12, "selfie_path": "s/1.jpg", "face_ok": true, "face_distancia": 0.31, "vivacidade_ok": true, "endereco": "Rua A, 1"}')::text;
select t_ok((select (v::jsonb)->>'tipo' = 'entrada' and (v::jsonb)->>'situacao' = 'aprovado' and ((v::jsonb)->>'nsr')::int = 1 and ((v::jsonb)->>'dentro_area')::boolean from t_v where k = 'e'), 'entrada aprovada (janela, local, rosto)');
select t_ok((select abs(((v::jsonb)->>'diferenca_min')::int) <= 1 from t_v where k = 'e'), 'diferença em relação ao previsto gravada');

-- 2) SAÍDA PARA INTERVALO 4 h antes do previsto: NÃO bloqueia (Portaria 671 art. 74), fica pendente "fora_janela"
insert into t_v select 'si', rest_ponto_registrar('{"lat": -23.5502, "lng": -46.6301, "selfie_path": "s/2.jpg", "face_ok": true, "vivacidade_ok": true}')::text;
select t_ok((select (v::jsonb)->>'tipo' = 'saida_intervalo' and (v::jsonb)->>'situacao' = 'pendente' and (v::jsonb)->'motivos' ? 'fora_janela' from t_v where k = 'si'), 'fora da janela: registra e fica pendente');

-- 3) RETORNO fora do local autorizado e rosto não confere
insert into t_v select 'r', rest_ponto_registrar('{"lat": -23.60, "lng": -46.70, "selfie_path": "s/3.jpg", "face_ok": false, "vivacidade_ok": false, "justificativa": "Entrega externa"}')::text;
select t_ok((select (v::jsonb)->>'tipo' = 'retorno_intervalo' and (v::jsonb)->'motivos' ?& array['fora_area','rosto_nao_confere','sem_vivacidade'] and ((v::jsonb)->>'distancia_m')::int > 5000 from t_v where k = 'r'), 'fora do local: pendente com distância e justificativa');

-- 4) SAÍDA em contingência (sem GPS/câmera): auditável, nunca aprovada automaticamente
insert into t_v select 's', rest_ponto_registrar('{"origem": "contingencia", "horario_informado": "2026-11-13T18:00:00-03:00", "justificativa": "Sem internet"}')::text;
select t_ok((select (v::jsonb)->>'tipo' = 'saida' and (v::jsonb)->'motivos' ?& array['contingencia','sem_gps','sem_selfie'] and (v::jsonb)->>'situacao' = 'pendente' from t_v where k = 's'), 'contingência: pendente');
select t_erro($$select rest_ponto_registrar('{}')$$, 'já foram feitas', 'quinta marcação recusada (sequência completa)');

-- imutabilidade
reset role; -- até o dono do banco é barrado pela trava
select t_erro($$update rest_ponto_marcacoes set horario = horario - interval '1 h' where nsr = 1$$, 'PONTO_IMUTAVEL', 'horário original não pode ser alterado');
select t_erro($$delete from rest_ponto_marcacoes where nsr = 1$$, 'PONTO_IMUTAVEL', 'marcação não pode ser excluída');
select t_ok((select bool_and(length(hash) = 64) and count(distinct hash) = 4 from rest_ponto_marcacoes), 'hash SHA-256 encadeado em todas');
select t_ok((select count(*) from rest_ponto_avisos where para is null and tipo = 'marcacao_pendente') = 3, 'administrador avisado das 3 pendentes');

-- 5) correção solicitada pelo empregado, aprovada: original preservado
select t_como('a0000000-0000-0000-0000-000000000002');
insert into rest_ponto_ajustes(data_ref, tipo, horario_proposto, justificativa) select data_ref, 'saida_intervalo', horario + interval '4 h', 'Bati antes por engano, saí às 12h' from rest_ponto_marcacoes where nsr = 2;
select t_erro($$select rest_ponto_ajuste_decidir((select id from rest_ponto_ajustes limit 1), true, null)$$, 'administrador', 'empregado não aprova a própria correção');
select t_como('a0000000-0000-0000-0000-000000000001');
select rest_ponto_ajuste_decidir((select id from rest_ponto_ajustes limit 1), true, 'ok');
select t_ok((select count(*) from rest_ponto_marcacoes where tipo = 'saida_intervalo') = 2, 'original e correção coexistem');
select t_ok((select substituida_por is not null from rest_ponto_marcacoes where nsr = 2), 'original marcado como substituído');
select t_ok((select origem = 'ajuste' and situacao = 'aprovado' and nsr = 5 from rest_ponto_marcacoes where substituida_por is null and tipo = 'saida_intervalo'), 'correção vira nova marcação (NSR 5)');

-- análise
select t_erro($$select rest_ponto_analisar((select id from rest_ponto_marcacoes where nsr = 3), 'rejeitado', '')$$, 'motivo', 'rejeitar exige motivo');
select rest_ponto_analisar((select id from rest_ponto_marcacoes where nsr = 3), 'aprovado', 'Entrega confirmada');
select rest_ponto_analisar((select id from rest_ponto_marcacoes where nsr = 4), 'aprovado', 'Queda de internet confirmada');
select t_ok((select count(*) from rest_ponto_marcacoes where situacao = 'pendente' and substituida_por is null) = 0, 'pendências analisadas');

-- 6) ausência por saúde com atestado; dado médico só para o próprio e o admin
select t_como('a0000000-0000-0000-0000-000000000002');
insert into rest_ponto_ausencias(data_inicio, data_fim, observacao, arquivo_path) values (current_date + 1, current_date + 2, 'Consulta', '10000000-0000-0000-0000-000000000001/f0000000-0000-0000-0000-000000000002/atestado.pdf');
select t_ok((select status = 'aguardando_conferencia' and entrega_fisica = 'aguardando' from rest_ponto_ausencias), 'atestado enviado — aguardando conferência');
update rest_ponto_ausencias set status = 'aceito'; select t_ok((select status from rest_ponto_ausencias) = 'aguardando_conferencia', 'empregado não aceita o próprio atestado');
select t_como('a0000000-0000-0000-0000-000000000001');
update rest_ponto_ausencias set entrega_fisica = 'entregue', entregue_em = current_date, status = 'aceito', conferido_por = rest_meu_funcionario(), conferido_em = now();
select t_ok((select entrega_fisica = 'entregue' and status = 'aceito' from rest_ponto_ausencias), 'admin registra entrega física e aceita');
select t_como('a0000000-0000-0000-0000-000000000002');
select t_ok((select count(*) from rest_ponto_avisos where tipo = 'ausencia') = 1, 'empregado avisado da conferência');
select t_como('b0000000-0000-0000-0000-000000000001');
select t_ok((select count(*) from rest_ponto_ausencias) = 0 and (select count(*) from rest_ponto_marcacoes) = 0 and (select count(*) from rest_func_ficha) = 0 and (select count(*) from rest_func_biometria) = 0, 'outro restaurante não vê nada');

-- 7) fechamento mensal
select t_como('a0000000-0000-0000-0000-000000000001');
select rest_ponto_fechar_mes(current_date, '{"funcionarios": 1}');
select t_como('a0000000-0000-0000-0000-000000000002');
select t_erro($$insert into rest_ponto_ajustes(data_ref, tipo, horario_proposto, justificativa) values (current_date, 'entrada', now(), 'Teste após fechar')$$, 'fechado', 'mês fechado bloqueia novas correções');
select t_erro($$select rest_ponto_fechar_mes(current_date, '{}')$$, 'administrador', 'empregado não fecha mês');
select t_como('a0000000-0000-0000-0000-000000000001');
select t_erro($$select rest_ponto_analisar((select id from rest_ponto_marcacoes where nsr = 1), 'rejeitado', 'x')$$, 'fechado', 'mês fechado bloqueia análise');
select t_erro($$select rest_ponto_reabrir_mes(current_date, '')$$, 'motivo', 'reabrir exige motivo');
select rest_ponto_reabrir_mes(current_date, 'Correção de atestado');
select t_ok((select status = 'reaberto' and motivo_reabertura is not null from rest_ponto_fechamentos), 'reabertura com histórico');
reset role;
select t_ok((select count(*) from rest_auditoria where tabela = 'rest_ponto_fechamentos') = 2, 'fechamento/reabertura na auditoria');
select t_ok((select count(*) from rest_ponto_avisos where tipo = 'fechamento') = 2, 'equipe avisada do fechamento');
\echo 'PONTO: todos os testes passaram'
