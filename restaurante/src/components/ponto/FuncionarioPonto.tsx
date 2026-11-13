import { useEffect, useState } from 'react';
import { Camera, Copy, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEu } from '../../lib/sessao';
import { enviarPrivado } from '../../lib/arquivos';
import { dataBR, dataHora, hoje } from '../../lib/fmt';
import { conferirJornada, fmtCPF, fmtPIS, validarCPF, validarPIS } from '../../lib/ponto/documentos.js';
import { DIAS_SEMANA, fmtHM, horaLocal, NOMES_TIPO, textoMotivos } from '../../lib/ponto/dados';
import { Abas, Aviso, avisarMudanca, Btn, Campo, Input, Modal, q, Select, Textarea, toast, useDados } from '../ui';
import { CorDia, Espelho, FotoPrivada } from './comum';

type F = { k: string; t: string; tipo?: 'date' | 'number' | 'email' | 'tel' | 'bool'; op?: string[]; dica?: string; largo?: boolean };
// Ficha conforme a Portaria MTP 671/2021, art. 14 (dados do registro de empregados / eSocial) e documentos usuais da admissão.
const GRUPOS: [string, F[]][] = [
  ['Identificação', [
    { k: 'nome_completo', t: 'Nome completo', largo: true }, { k: 'nome_social', t: 'Nome social' }, { k: 'cpf', t: 'CPF', dica: 'Também é o número da Carteira de Trabalho Digital' },
    { k: 'rg', t: 'RG' }, { k: 'rg_orgao', t: 'Órgão emissor' }, { k: 'rg_uf', t: 'UF do RG' }, { k: 'rg_emissao', t: 'Emissão do RG', tipo: 'date' },
    { k: 'data_nascimento', t: 'Data de nascimento', tipo: 'date' }, { k: 'sexo', t: 'Sexo', op: ['Feminino', 'Masculino'] },
    { k: 'estado_civil', t: 'Estado civil', op: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Separado(a)', 'Viúvo(a)'] },
    { k: 'raca_cor', t: 'Raça/cor (autodeclarada)', op: ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não informada'] },
    { k: 'nacionalidade', t: 'Nacionalidade' }, { k: 'naturalidade', t: 'Naturalidade (cidade)' }, { k: 'uf_nascimento', t: 'UF de nascimento' },
    { k: 'nome_mae', t: 'Nome da mãe', largo: true }, { k: 'nome_pai', t: 'Nome do pai', largo: true },
    { k: 'escolaridade', t: 'Grau de instrução', op: ['Analfabeto', 'Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Superior incompleto', 'Superior completo', 'Pós-graduação'] },
    { k: 'deficiencia', t: 'Pessoa com deficiência', op: ['Não', 'Física', 'Auditiva', 'Visual', 'Intelectual', 'Múltipla', 'Reabilitado'] },
  ]],
  ['Endereço e contato', [
    { k: 'cep', t: 'CEP' }, { k: 'logradouro', t: 'Logradouro', largo: true }, { k: 'numero', t: 'Número' }, { k: 'complemento', t: 'Complemento' }, { k: 'bairro', t: 'Bairro' },
    { k: 'cidade', t: 'Cidade' }, { k: 'uf', t: 'UF' }, { k: 'telefone', t: 'Telefone', tipo: 'tel' }, { k: 'email', t: 'E-mail', tipo: 'email' },
    { k: 'contato_emergencia_nome', t: 'Contato de emergência' }, { k: 'contato_emergencia_tel', t: 'Telefone de emergência', tipo: 'tel' },
  ]],
  ['Documentos trabalhistas', [
    { k: 'pis', t: 'PIS/PASEP/NIT' }, { k: 'ctps_digital', t: 'Carteira de Trabalho Digital', tipo: 'bool', dica: 'Desde 2019 a CTPS é digital e o número é o CPF (Lei 13.874/2019; Portaria 671, art. 3º)' },
    { k: 'ctps_numero', t: 'CTPS física — número' }, { k: 'ctps_serie', t: 'CTPS física — série' }, { k: 'ctps_uf', t: 'CTPS física — UF' },
    { k: 'titulo_eleitor', t: 'Título de eleitor' }, { k: 'titulo_zona', t: 'Zona' }, { k: 'titulo_secao', t: 'Seção' },
    { k: 'reservista', t: 'Certificado de reservista' }, { k: 'cnh', t: 'CNH' }, { k: 'cnh_categoria', t: 'Categoria CNH' }, { k: 'cnh_validade', t: 'Validade CNH', tipo: 'date' },
  ]],
  ['Contrato de trabalho', [
    { k: 'matricula', t: 'Matrícula' }, { k: 'cargo', t: 'Cargo' }, { k: 'cbo', t: 'CBO', dica: 'Ex.: cozinheiro geral 5132-05; auxiliar de cozinha 5135-05; garçom 5134-05; caixa 4211-25' },
    { k: 'setor', t: 'Setor' }, { k: 'local_trabalho', t: 'Local de trabalho' }, { k: 'data_admissao', t: 'Data de admissão', tipo: 'date' },
    { k: 'tipo_contrato', t: 'Tipo de contrato', op: ['Prazo indeterminado', 'Experiência', 'Prazo determinado', 'Intermitente', 'Tempo parcial', 'Aprendiz'] },
    { k: 'experiencia_fim', t: 'Fim da experiência', tipo: 'date', dica: 'Máximo 90 dias (CLT art. 445, parágrafo único)' }, { k: 'contrato_fim', t: 'Fim do contrato (prazo determinado)', tipo: 'date' },
    { k: 'salario', t: 'Salário (R$)', tipo: 'number' }, { k: 'tipo_salario', t: 'Forma de salário', op: ['Mensalista', 'Horista', 'Diarista', 'Comissionado'] },
    { k: 'insalubridade', t: 'Insalubridade', op: ['Não', 'Grau mínimo (10%)', 'Grau médio (20%)', 'Grau máximo (40%)'] }, { k: 'periculosidade', t: 'Periculosidade (30%)', tipo: 'bool' },
    { k: 'vale_transporte', t: 'Optou pelo vale-transporte', tipo: 'bool' }, { k: 'aso_admissional', t: 'ASO admissional', tipo: 'date', dica: 'Exame médico admissional (CLT art. 168; NR-7)' }, { k: 'aso_validade', t: 'Próximo exame periódico', tipo: 'date' },
    { k: 'data_demissao', t: 'Data de desligamento', tipo: 'date' },
  ]],
  ['Pagamento', [{ k: 'banco', t: 'Banco' }, { k: 'agencia', t: 'Agência' }, { k: 'conta', t: 'Conta' }, { k: 'tipo_conta', t: 'Tipo de conta', op: ['Corrente', 'Poupança', 'Salário'] }, { k: 'pix', t: 'Chave PIX' }]],
];

export default function FuncionarioPonto({ f, fechar }: { f: any; fechar: () => void }) {
  const [aba, setAba] = useState('ficha');
  const { rest } = useEu();
  const { dados: ficha, carregando: carregandoFicha } = useDados(() => q<any>(supabase.from('rest_func_ficha').select('*').eq('funcionario_id', f.id).maybeSingle()), [f.id]);
  return (
    <Modal aberto largo fechar={fechar} titulo={f.nome}>
      <Abas abas={[{ id: 'ficha', t: 'Ficha cadastral' }, { id: 'jornada', t: 'Jornada' }, { id: 'rosto', t: 'Rosto' }, { id: 'espelho', t: 'Espelho' }, { id: 'historico', t: 'Histórico' }]} ativa={aba} mudar={setAba} />
      {aba === 'ficha' && (carregandoFicha && ficha === null ? <div className="p-4 text-sm text-slate-500">Carregando…</div> : <Ficha f={f} ficha={ficha} />)}
      {aba === 'jornada' && <Jornada f={f} />}
      {aba === 'rosto' && <Rosto f={f} />}
      {aba === 'espelho' && <Espelho func={f.id} nome={f.nome} ficha={ficha} empregador={rest.nome} cnpj={rest.cnpj} />}
      {aba === 'historico' && <Historico f={f} />}
    </Modal>
  );
}

function Ficha({ f, ficha }: { f: any; ficha: any }) {
  const { rest } = useEu();
  const [d, setD] = useState<any>(() => ({ nacionalidade: 'Brasileira', ctps_digital: true, tipo_contrato: 'Prazo indeterminado', tipo_salario: 'Mensalista', nome_completo: f.nome, dependentes: [], ...(ficha ?? {}) }));
  const [salvando, setSalvando] = useState(false);
  const mudar = (k: string, v: any) => setD((x: any) => ({ ...x, [k]: v }));
  const erros = [d.cpf && !validarCPF(d.cpf) && 'CPF inválido (confira os dígitos)', d.pis && !validarPIS(d.pis) && 'PIS/PASEP/NIT inválido (confira os dígitos)',
    d.tipo_contrato === 'Experiência' && d.experiencia_fim && d.data_admissao && (Date.parse(d.experiencia_fim) - Date.parse(d.data_admissao)) / 86400000 > 89 && 'Contrato de experiência passa de 90 dias (CLT art. 445)'].filter(Boolean) as string[];
  const faltam = ['nome_completo', 'cpf', 'data_nascimento', 'data_admissao', 'cargo', 'cbo', 'salario', 'pis'].filter((k) => !d[k]);
  const foto = async (arq?: File) => { if (!arq) return; try { mudar('foto_path', await enviarPrivado(rest.id, f.id, 'ficha', arq)); toast('Foto enviada — toque em Salvar'); } catch (e: any) { toast(e.message, 'erro'); } };
  const salvar = async () => {
    if (erros.length) return toast(erros[0], 'erro');
    setSalvando(true);
    try {
      const { id: _id, atualizado_em: _a, ...resto } = d;
      const reg: any = { ...resto, funcionario_id: f.id, atualizado_em: new Date().toISOString() };
      for (const g of GRUPOS) for (const c of g[1]) if (reg[c.k] === '') reg[c.k] = null;
      if (reg.cpf) reg.cpf = fmtCPF(reg.cpf); if (reg.pis) reg.pis = fmtPIS(reg.pis);
      if (reg.salario != null) reg.salario = Number(String(reg.salario).replace(',', '.'));
      await q(supabase.from('rest_func_ficha').upsert(reg, { onConflict: 'funcionario_id' }));
      toast('Ficha salva'); avisarMudanca();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
  };
  const deps: any[] = d.dependentes ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FotoPrivada caminho={d.foto_path} className="h-24 w-24" />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium dark:bg-slate-800"><Camera className="h-4 w-4" />Foto 3x4<input type="file" accept="image/*" className="hidden" onChange={(e) => foto(e.target.files?.[0])} /></label>
      </div>
      {faltam.length > 0 && <Aviso tipo="alerta">Para o registro de empregado (Portaria 671, art. 14) faltam: {faltam.map((k) => GRUPOS.flatMap((g) => g[1]).find((c) => c.k === k)?.t).join(', ')}.</Aviso>}
      {erros.map((e) => <Aviso key={e} tipo="erro">{e}</Aviso>)}
      {GRUPOS.map(([g, campos]) => (
        <details key={g} open={g === 'Identificação' || g === 'Contrato de trabalho'} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <summary className="cursor-pointer font-semibold">{g}</summary>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{campos.map((c) => (
            <div key={c.k} className={c.largo ? 'sm:col-span-2' : ''}>
              {c.tipo === 'bool' ? <label className="flex items-start gap-2 pt-6 text-sm"><input type="checkbox" checked={!!d[c.k]} onChange={(e) => mudar(c.k, e.target.checked)} className="mt-0.5" /><span>{c.t}{c.dica && <span className="block text-xs text-slate-500">{c.dica}</span>}</span></label>
                : <Campo rotulo={c.t} dica={c.dica}>{c.op ? <Select value={d[c.k] ?? ''} onChange={(e) => mudar(c.k, e.target.value)}><option value="">—</option>{c.op.map((o) => <option key={o}>{o}</option>)}</Select>
                  : <Input type={c.tipo === 'number' ? 'text' : c.tipo ?? 'text'} inputMode={c.tipo === 'number' ? 'decimal' : undefined} value={d[c.k] ?? ''} onChange={(e) => mudar(c.k, e.target.value)} />}</Campo>}
            </div>))}</div>
        </details>))}
      <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <summary className="cursor-pointer font-semibold">Dependentes ({deps.length})</summary>
        <div className="mt-3 space-y-2">{deps.map((x, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Input placeholder="Nome" value={x.nome ?? ''} onChange={(e) => mudar('dependentes', deps.map((y, j) => (j === i ? { ...y, nome: e.target.value } : y)))} className="sm:col-span-2" />
            <Input placeholder="CPF" value={x.cpf ?? ''} onChange={(e) => mudar('dependentes', deps.map((y, j) => (j === i ? { ...y, cpf: e.target.value } : y)))} />
            <Input type="date" value={x.nascimento ?? ''} onChange={(e) => mudar('dependentes', deps.map((y, j) => (j === i ? { ...y, nascimento: e.target.value } : y)))} />
            <div className="flex gap-1"><Select value={x.parentesco ?? ''} onChange={(e) => mudar('dependentes', deps.map((y, j) => (j === i ? { ...y, parentesco: e.target.value } : y)))}><option value="">Parentesco</option>{['Filho(a)', 'Cônjuge', 'Companheiro(a)', 'Enteado(a)', 'Pai/Mãe', 'Outro'].map((o) => <option key={o}>{o}</option>)}</Select>
              <button onClick={() => mudar('dependentes', deps.filter((_, j) => j !== i))} className="px-1 text-slate-400" aria-label="Remover"><Trash2 className="h-4 w-4" /></button></div>
          </div>))}
          <Btn variante="secundario" onClick={() => mudar('dependentes', [...deps, {}])}><Plus className="h-4 w-4" />Adicionar dependente</Btn>
        </div>
      </details>
      <Campo rotulo="Observações"><Textarea rows={2} value={d.observacoes ?? ''} onChange={(e) => mudar('observacoes', e.target.value)} /></Campo>
      <p className="text-xs text-slate-500">Dados pessoais tratados para cumprir obrigações trabalhistas e previdenciárias (LGPD art. 7º, II). Só o administrador edita; o funcionário pode ver a própria ficha.</p>
      <Btn className="w-full" carregando={salvando} onClick={salvar}>Salvar ficha</Btn>
    </div>
  );
}

const VAZIO = { entrada: '', int_ini: '', int_fim: '', saida: '' };
function Jornada({ f }: { f: any }) {
  const { dados } = useDados(async () => {
    const [js, locais, folgas] = await Promise.all([
      q<any[]>(supabase.from('rest_ponto_jornadas').select('*').eq('funcionario_id', f.id).order('valido_desde', { ascending: false })),
      q<any[]>(supabase.from('rest_ponto_locais').select('id, nome').eq('ativo', true)),
      q<any[]>(supabase.from('rest_ponto_folgas').select('*').eq('funcionario_id', f.id).gte('data', hoje()).order('data')),
    ]);
    return { js, locais, folgas };
  }, [f.id]);
  const [d, setD] = useState<any>(null);
  const [folga, setFolga] = useState({ data: '', motivo: '' });
  useEffect(() => {
    if (!dados || d) return;
    const atual = dados.js[0];
    setD(atual ? { ...atual, valido_desde: hoje(), semana: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, atual.semana[i] ?? null])) }
      : { valido_desde: hoje(), quatro_marcacoes: true, locais: [], escala: '', regras: '', semana: { 1: { entrada: '08:00', int_ini: '12:00', int_fim: '13:00', saida: '17:00' }, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null } });
  }, [dados, d]);
  if (!dados || !d) return <div className="p-4 text-sm text-slate-500">Carregando…</div>;
  const dia = (i: number, k: string, v: string) => setD({ ...d, semana: { ...d.semana, [i]: { ...(d.semana[i] ?? VAZIO), [k]: v } } });
  const { avisos, totalSemana } = conferirJornada(d.semana);
  const salvar = async () => {
    const semana = Object.fromEntries(Object.entries(d.semana).map(([k, v]: any) => [k, v && v.entrada && v.saida ? { entrada: v.entrada, saida: v.saida, ...(d.quatro_marcacoes && v.int_ini && v.int_fim ? { int_ini: v.int_ini, int_fim: v.int_fim } : {}) } : null]));
    if (!Object.values(semana).some(Boolean)) return toast('Informe ao menos um dia de trabalho', 'erro');
    try {
      await q(supabase.from('rest_ponto_jornadas').upsert({ funcionario_id: f.id, valido_desde: d.valido_desde, semana, quatro_marcacoes: d.quatro_marcacoes, locais: d.locais, escala: d.escala || null, regras: d.regras || null }, { onConflict: 'funcionario_id,valido_desde' }));
      toast('Jornada salva (as versões anteriores ficam no histórico)'); avisarMudanca();
    } catch (e: any) { toast(e.message, 'erro'); }
  };
  return (
    <div className="space-y-3">
      <Aviso>Cada funcionário tem a sua jornada. Uma alteração vale a partir da data escolhida; os dias anteriores continuam apurados com a jornada da época.</Aviso>
      <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Dia</th><th>Trabalha</th><th>Entrada</th>{d.quatro_marcacoes && <><th>Saída intervalo</th><th>Retorno</th></>}<th>Saída</th></tr></thead>
        <tbody>{[1, 2, 3, 4, 5, 6, 7].map((i) => { const c = d.semana[i]; return (
          <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
            <td className="py-1.5 font-medium">{DIAS_SEMANA[i]}</td>
            <td><input type="checkbox" checked={!!c} onChange={(e) => setD({ ...d, semana: { ...d.semana, [i]: e.target.checked ? { ...(d.semana[1] ?? VAZIO) } : null } })} /></td>
            {(['entrada', ...(d.quatro_marcacoes ? ['int_ini', 'int_fim'] : []), 'saida'] as string[]).map((k) => <td key={k} className="pr-1">{c ? <Input type="time" value={c[k] ?? ''} onChange={(e) => dia(i, k, e.target.value)} className="!px-2 !py-1" /> : <span className="text-xs text-slate-400">folga</span>}</td>)}
          </tr>); })}</tbody>
      </table></div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Btn variante="secundario" onClick={() => setD({ ...d, semana: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [i, d.semana[i] ? { ...d.semana[1] } : null])) })}><Copy className="h-4 w-4" />Copiar segunda para os dias marcados</Btn>
        <span className="text-slate-500">Total semanal: <b>{fmtHM(totalSemana)}</b></span>
      </div>
      {avisos.map((a: string) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Campo rotulo="Vale a partir de"><Input type="date" value={d.valido_desde} onChange={(e) => setD({ ...d, valido_desde: e.target.value })} /></Campo>
        <Campo rotulo="Escala"><Input value={d.escala ?? ''} onChange={(e) => setD({ ...d, escala: e.target.value })} placeholder="Ex.: 6x1, 5x2, 12x36 (com acordo)" /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.quatro_marcacoes} onChange={(e) => setD({ ...d, quatro_marcacoes: e.target.checked })} />Registrar o intervalo (4 marcações por dia)</label>
        <div className="text-xs text-slate-500">Sem registro do intervalo, ele deve ao menos estar pré-anotado (CLT art. 74, §2º) — os horários acima valem como pré-anotação.</div>
      </div>
      {dados.locais.length > 0 && <Campo rotulo="Locais permitidos (nenhum marcado = qualquer local cadastrado)"><div className="flex flex-wrap gap-2">{dados.locais.map((l) => <label key={l.id} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm dark:border-slate-700"><input type="checkbox" checked={d.locais.includes(l.id)} onChange={(e) => setD({ ...d, locais: e.target.checked ? [...d.locais, l.id] : d.locais.filter((x: string) => x !== l.id) })} />{l.nome}</label>)}</div></Campo>}
      <Campo rotulo="Regras específicas"><Textarea rows={2} value={d.regras ?? ''} onChange={(e) => setD({ ...d, regras: e.target.value })} placeholder="Ex.: banco de horas por acordo individual (compensação em até 6 meses, CLT art. 59 §5º)" /></Campo>
      <Btn className="w-full" onClick={salvar}>Salvar jornada</Btn>
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <div className="mb-2 font-semibold">Folgas e descansos avulsos</div>
        <div className="flex flex-wrap gap-2"><Input type="date" value={folga.data} onChange={(e) => setFolga({ ...folga, data: e.target.value })} className="!w-auto" /><Input placeholder="Motivo (feriado, compensação, troca)" value={folga.motivo} onChange={(e) => setFolga({ ...folga, motivo: e.target.value })} className="!w-auto flex-1" />
          <Btn variante="secundario" onClick={async () => { if (!folga.data) return; try { await q(supabase.from('rest_ponto_folgas').insert({ funcionario_id: f.id, data: folga.data, motivo: folga.motivo || null })); setFolga({ data: '', motivo: '' }); avisarMudanca(); } catch (e: any) { toast(e.message, 'erro'); } }}><Plus className="h-4 w-4" />Adicionar</Btn></div>
        <div className="mt-2 space-y-1 text-sm">{dados.folgas.map((x) => <div key={x.id} className="flex items-center gap-2">{dataBR(x.data)} {x.motivo && <span className="text-slate-500">· {x.motivo}</span>}<button className="ml-auto text-slate-400" aria-label="Remover folga" onClick={async () => { await supabase.from('rest_ponto_folgas').delete().eq('id', x.id); avisarMudanca(); }}><Trash2 className="h-4 w-4" /></button></div>)}</div>
      </div>
      {dados.js.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-slate-500">Versões anteriores ({dados.js.length})</summary>{dados.js.map((j) => <div key={j.id} className="mt-1 text-xs">desde {dataBR(j.valido_desde)}: {[1, 2, 3, 4, 5, 6, 7].map((i) => j.semana[i] ? `${DIAS_SEMANA[i].slice(0, 3)} ${j.semana[i].entrada}–${j.semana[i].saida}` : null).filter(Boolean).join(' · ')}</div>)}</details>}
    </div>
  );
}

function Rosto({ f }: { f: any }) {
  const { dados, carregando } = useDados(() => q<any>(supabase.from('rest_func_biometria').select('funcionario_id, foto_path, ciencia_em, ciencia_versao, atualizado_em').eq('funcionario_id', f.id).maybeSingle()), [f.id]);
  const apagar = async () => {
    if (!confirm('Apagar o rosto de referência? No próximo registro o funcionário cadastra de novo.')) return;
    const { error } = await supabase.from('rest_func_biometria').delete().eq('funcionario_id', f.id);
    if (error) toast(error.message, 'erro'); else { toast('Rosto de referência apagado'); avisarMudanca(); }
  };
  if (carregando && dados === null) return <div className="p-4 text-sm text-slate-500">Carregando…</div>;
  if (dados === null) return <div className="space-y-3"><Aviso>O rosto ainda não foi cadastrado. No primeiro registro de ponto, o próprio funcionário tira a foto de referência e confirma a ciência sobre o uso dos dados (LGPD).</Aviso></div>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3"><FotoPrivada caminho={dados?.foto_path} className="h-32 w-32" /><div className="text-sm">Cadastrado em {dataHora(dados?.atualizado_em)}<br /><span className="text-slate-500">Ciência registrada em {dataHora(dados?.ciencia_em)} ({dados?.ciencia_versao})</span></div></div>
      <Aviso>Guardamos só um código numérico do rosto e esta foto. A comparação é feita no aparelho; cada registro guarda a selfie para auditoria.</Aviso>
      <Btn variante="perigo" onClick={apagar}><Trash2 className="h-4 w-4" />Apagar e pedir novo cadastro</Btn>
    </div>
  );
}

function Historico({ f }: { f: any }) {
  const { dados } = useDados(() => q<any[]>(supabase.from('rest_ponto_marcacoes').select('*').eq('funcionario_id', f.id).order('nsr', { ascending: false }).limit(120)), [f.id]);
  if (!dados) return <div className="p-4 text-sm text-slate-500">Carregando…</div>;
  if (!dados.length) return <p className="text-sm text-slate-500">Nenhuma marcação ainda.</p>;
  return (
    <div className="space-y-2">{dados.map((m) => (
      <div key={m.id} className={`flex gap-3 rounded-xl border p-2 text-sm dark:border-slate-800 ${m.substituida_por || m.situacao === 'rejeitado' ? 'opacity-60' : ''}`}>
        <FotoPrivada caminho={m.selfie_path} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <b>{dataBR(m.data_ref)} {horaLocal(m.horario)}</b> · {NOMES_TIPO[m.tipo as keyof typeof NOMES_TIPO]} <span className="text-xs text-slate-500">NSR {m.nsr} · {m.origem}</span>
          <div className="text-xs text-slate-500">{m.origem === 'ajuste' ? 'Correção aprovada pelo administrador' : m.endereco ?? (m.lat != null ? `${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}` : 'sem localização')}{m.distancia_m != null && ` · ${m.distancia_m} m`}{m.motivos?.length ? ` · ${textoMotivos(m.motivos)}` : ''}</div>
          {m.justificativa && <div className="text-xs">Justificativa: {m.justificativa}</div>}
          {m.obs_analise && <div className="text-xs text-slate-500">Análise: {m.obs_analise} ({dataHora(m.analisado_em)})</div>}
          {m.substituida_por && <div className="text-xs text-amber-700">Substituída por correção aprovada (original preservado)</div>}
        </div>
        <div className="shrink-0 self-start"><CorDia cor={m.situacao === 'aprovado' ? 'verde' : m.situacao === 'pendente' ? 'amarelo' : 'vermelho'}>{m.substituida_por ? 'Substituída' : m.situacao === 'aprovado' ? 'Aprovada' : m.situacao === 'pendente' ? 'Em análise' : 'Rejeitada'}</CorDia></div>
      </div>))}</div>
  );
}
