import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, Opcoes, inputCls, textareaCls } from "@/components/app/kit";
import { useAuth } from "@/lib/auth";
import {
  DIAGNOSTICOS, TERAPIAS, TERMOS_VERSAO, UFS, cpfValido, dataValida, digits, emailValido, fmtCEP, fmtCPF, fmtTel, idade, telValido,
} from "@/lib/br";

export const Route = createFileRoute("/completar-cadastro")({ component: () => <AppShell><Completar /></AppShell> });

const db = supabase as any;
type Filho = {
  id?: string; nome: string; nascimento: string; sexo: string; cpf: string;
  diagnosticos: string[]; diagnostico_outro: string; data_diagnostico: string; profissional: string;
  usa_medicacao: string; acompanhamento: string; terapias: string[]; frequenta_escola: string; escola: string;
  necessidades: string; possui_bpc: string; aguardando_bpc: string; observacoes: string;
};
const filhoVazio = (): Filho => ({ nome: "", nascimento: "", sexo: "", cpf: "", diagnosticos: [], diagnostico_outro: "", data_diagnostico: "", profissional: "", usa_medicacao: "", acompanhamento: "", terapias: [], frequenta_escola: "", escola: "", necessidades: "", possui_bpc: "", aguardando_bpc: "", observacoes: "" });
const sn = (v: string) => (v === "Sim" ? true : v === "Não" ? false : null);
const nsn = (v: boolean | null | undefined) => (v === true ? "Sim" : v === false ? "Não" : "");
const ETAPAS = ["Mãe ou responsável", "Pai ou segundo responsável", "Dados de cada filho", "Revisão e consentimentos"];

function Completar() {
  const { user, perfil, familia, refresh } = useAuth();
  const nav = useNavigate();
  const editando = !!familia;
  const [etapa, setEtapa] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [m, setM] = useState<Record<string, string>>({
    mae_nome: "", cpf: "", mae_nascimento: "", mae_telefone: "", mae_email: "", cep: "", endereco: "", bairro: "", cidade: "", uf: "",
    estado_civil: "", profissao: "", quem_preenche: "A própria mãe / responsável", emergencia_nome: "", emergencia_telefone: "",
  });
  const [s, setS] = useState<Record<string, string>>({ segundo_nome: "", cpf: "", segundo_nascimento: "", segundo_telefone: "", segundo_email: "", segundo_profissao: "", segundo_parentesco: "" });
  const [filhos, setFilhos] = useState<Filho[]>([filhoVazio()]);
  const [c, setC] = useState({ termos: editando, dados: editando, resp: editando, saude: false, com: false });

  useEffect(() => {
    setM((x) => ({ ...x, mae_telefone: x.mae_telefone || fmtTel(perfil?.telefone ?? ""), mae_email: x.mae_email || (user?.email ?? "") }));
  }, [perfil, user]);

  // Modo edição: carrega dados existentes
  useEffect(() => {
    if (!familia) return;
    (async () => {
      const f: any = familia;
      setM((x) => Object.fromEntries(Object.keys(x).map((k) => [k, f[k] ?? x[k] ?? ""])) as any);
      setS((x) => Object.fromEntries(Object.keys(x).map((k) => [k, f[k] ?? ""])) as any);
      const [cp, fi, sa, co] = await Promise.all([
        db.from("cpfs").select("*").eq("familia_id", f.id),
        db.from("filhos").select("*").eq("familia_id", f.id).order("created_at"),
        db.from("filhos_saude").select("*").eq("familia_id", f.id),
        db.rpc("consentimento_ativo", { _uid: user!.id, _tipo: "saude" }),
      ]);
      const cpfs = cp.data ?? [];
      setM((x) => ({ ...x, cpf: fmtCPF(cpfs.find((z: any) => z.titular === "mae")?.cpf ?? ""), mae_telefone: fmtTel(f.mae_telefone ?? ""), cep: fmtCEP(f.cep ?? "") }));
      setS((x) => ({ ...x, cpf: fmtCPF(cpfs.find((z: any) => z.titular === "segundo")?.cpf ?? ""), segundo_telefone: fmtTel(f.segundo_telefone ?? "") }));
      const saude = sa.data ?? [];
      if ((fi.data ?? []).length) {
        setFilhos((fi.data ?? []).map((k: any) => {
          const h = saude.find((z: any) => z.filho_id === k.id) ?? {};
          return {
            ...filhoVazio(), id: k.id, nome: k.nome, nascimento: k.nascimento ?? "", sexo: k.sexo ?? "",
            cpf: fmtCPF(cpfs.find((z: any) => z.filho_id === k.id)?.cpf ?? ""),
            diagnosticos: h.diagnosticos ?? [], diagnostico_outro: h.diagnostico_outro ?? "", data_diagnostico: h.data_diagnostico ?? "",
            profissional: h.profissional ?? "", usa_medicacao: nsn(h.usa_medicacao), acompanhamento: nsn(h.acompanhamento),
            terapias: (h.terapias ?? "").split(", ").filter(Boolean), frequenta_escola: nsn(h.frequenta_escola), escola: h.escola ?? "",
            necessidades: h.necessidades ?? "", possui_bpc: nsn(h.possui_bpc), aguardando_bpc: nsn(h.aguardando_bpc), observacoes: h.observacoes ?? "",
          };
        }));
      }
      setC((x) => ({ ...x, saude: !!co.data }));
    })();
  }, [familia, user]);

  async function buscarCEP(v: string) {
    const d = digits(v);
    if (d.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro) setM((x) => ({ ...x, endereco: x.endereco || j.logradouro || "", bairro: j.bairro || x.bairro, cidade: j.localidade || x.cidade, uf: j.uf || x.uf }));
    } catch { /* sem internet: preenche à mão */ }
  }

  const temSaude = filhos.some((k) => k.diagnosticos.length || k.terapias.length || k.data_diagnostico || k.profissional || k.usa_medicacao || k.acompanhamento || k.necessidades || k.possui_bpc || k.aguardando_bpc || k.diagnostico_outro);

  function validar(): boolean {
    const er: Record<string, string> = {};
    if (etapa === 0) {
      if (m.mae_nome.trim().split(/\s+/).length < 2) er.mae_nome = "Informe nome e sobrenome.";
      if (!cpfValido(m.cpf)) er.cpf = "CPF inválido. Confira os números.";
      if (!dataValida(m.mae_nascimento) || (idade(m.mae_nascimento) ?? 0) < 14) er.mae_nascimento = "Informe uma data de nascimento válida.";
      if (!telValido(m.mae_telefone)) er.mae_telefone = "Digite o telefone com DDD.";
      if (m.mae_email && !emailValido(m.mae_email)) er.mae_email = "E-mail inválido.";
      if (digits(m.cep).length !== 8) er.cep = "O CEP tem 8 números.";
      if (!m.endereco.trim()) er.endereco = "Informe rua e número.";
      if (!m.bairro.trim()) er.bairro = "Informe o bairro.";
      if (!m.cidade.trim()) er.cidade = "Informe a cidade.";
      if (!m.uf) er.uf = "Escolha o estado.";
    }
    if (etapa === 1) {
      if (s.cpf && !cpfValido(s.cpf)) er.s_cpf = "CPF inválido.";
      if (s.segundo_telefone && !telValido(s.segundo_telefone)) er.s_tel = "Telefone inválido.";
      if (s.segundo_email && !emailValido(s.segundo_email)) er.s_email = "E-mail inválido.";
    }
    if (etapa === 2) {
      filhos.forEach((k, i) => {
        if (k.nome.trim().split(/\s+/).length < 2) er[`k${i}_nome`] = "Informe nome e sobrenome.";
        if (!dataValida(k.nascimento)) er[`k${i}_nasc`] = "Data inválida (não pode ser no futuro).";
        if (k.cpf && !cpfValido(k.cpf)) er[`k${i}_cpf`] = "CPF inválido.";
      });
    }
    if (etapa === 3) {
      if (!c.termos) er.termos = "Aceite os termos e a política de privacidade.";
      if (!c.dados) er.dados = "Este consentimento é necessário para o cadastro.";
      if (!c.resp) er.resp = "Confirme que é responsável pela criança ou tem autorização.";
      if (temSaude && !c.saude) er.saude = "Você informou dados de saúde. Marque este consentimento ou volte e apague esses campos.";
    }
    setErros(er);
    if (Object.keys(er).length) {
      setTimeout(() => (document.querySelector('[aria-invalid="true"], [role="alert"]') as HTMLElement | null)?.focus?.(), 50);
      toast.error("Confira os campos destacados.");
      return false;
    }
    return true;
  }

  async function salvar() {
    if (!validar() || !user) return;
    setSalvando(true);
    try {
      const reg = async (tipo: string, aceito: boolean) => db.from("consentimentos").insert({ user_id: user.id, tipo, versao: TERMOS_VERSAO, aceito });
      if (!editando) {
        await reg("termos", true); await reg("dados_pessoais", true); await reg("responsavel_legal", true);
        await reg("comunicacoes", c.com);
      }
      await reg("saude", c.saude && temSaude ? true : false);

      const dadosFam: any = {
        mae_nome: m.mae_nome.trim(), mae_nascimento: m.mae_nascimento, mae_telefone: digits(m.mae_telefone), mae_email: m.mae_email.trim() || null,
        cep: digits(m.cep), endereco: m.endereco.trim(), bairro: m.bairro.trim(), cidade: m.cidade.trim(), uf: m.uf,
        estado_civil: m.estado_civil || null, profissao: m.profissao || null, quem_preenche: m.quem_preenche,
        emergencia_nome: m.emergencia_nome || null, emergencia_telefone: digits(m.emergencia_telefone) || null,
        segundo_nome: s.segundo_nome || null, segundo_nascimento: s.segundo_nascimento || null, segundo_telefone: digits(s.segundo_telefone) || null,
        segundo_email: s.segundo_email || null, segundo_profissao: s.segundo_profissao || null, segundo_parentesco: s.segundo_parentesco || null,
      };
      let famId = familia?.id as string | undefined;
      if (editando) {
        const { error } = await db.from("familias").update(dadosFam).eq("id", famId);
        if (error) throw error;
        await db.from("cpfs").delete().eq("familia_id", famId);
      } else {
        const { data, error } = await db.from("familias").insert({ ...dadosFam, user_id: user.id }).select("id").single();
        if (error) throw error;
        famId = data.id;
      }
      const cpfs: any[] = [{ familia_id: famId, titular: "mae", cpf: digits(m.cpf) }];
      if (s.cpf) cpfs.push({ familia_id: famId, titular: "segundo", cpf: digits(s.cpf) });

      const idsMantidos: string[] = [];
      for (const k of filhos) {
        let fid = k.id;
        const base = { nome: k.nome.trim(), nascimento: k.nascimento, sexo: k.sexo || null };
        if (fid) { await db.from("filhos").update(base).eq("id", fid); }
        else {
          const { data, error } = await db.from("filhos").insert({ ...base, familia_id: famId }).select("id").single();
          if (error) throw error;
          fid = data.id;
        }
        idsMantidos.push(fid!);
        if (k.cpf) cpfs.push({ familia_id: famId, titular: "filho", filho_id: fid, cpf: digits(k.cpf) });
        if (c.saude && temSaude) {
          const { error } = await db.from("filhos_saude").upsert({
            filho_id: fid, familia_id: famId, diagnosticos: k.diagnosticos, diagnostico_outro: k.diagnostico_outro || null,
            data_diagnostico: k.data_diagnostico || null, profissional: k.profissional || null, usa_medicacao: sn(k.usa_medicacao),
            acompanhamento: sn(k.acompanhamento), terapias: k.terapias.join(", ") || null, frequenta_escola: sn(k.frequenta_escola),
            escola: k.escola || null, necessidades: k.necessidades || null, possui_bpc: sn(k.possui_bpc), aguardando_bpc: sn(k.aguardando_bpc),
            observacoes: k.observacoes || null,
          });
          if (error) throw error;
        }
      }
      if (editando) {
        const { data: atuais } = await db.from("filhos").select("id").eq("familia_id", famId);
        for (const a of atuais ?? []) if (!idsMantidos.includes(a.id)) await db.from("filhos").delete().eq("id", a.id);
      }
      const { error: ec } = await db.from("cpfs").insert(cpfs);
      if (ec) throw ec;
      await refresh();
      if (editando) { toast.success("Cadastro atualizado."); nav({ to: "/perfil" }); }
      else nav({ to: "/cadastro-concluido", search: { abrir: "1" } as any });
    } catch (e: any) {
      toast.error("Não foi possível salvar: " + (e?.message ?? "tente de novo"));
    } finally { setSalvando(false); }
  }

  const fm = (k: string) => ({ id: k, className: inputCls, value: m[k] ?? "", "aria-invalid": !!erros[k], onChange: (e: any) => setM({ ...m, [k]: e.target.value }) });
  const fs = (k: string) => ({ id: "s_" + k, className: inputCls, value: s[k] ?? "", onChange: (e: any) => setS({ ...s, [k]: e.target.value }) });
  const setK = (i: number, patch: Partial<Filho>) => setFilhos(filhos.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const grid = "grid gap-4 sm:grid-cols-2";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold text-primary">{editando ? "Atualizar cadastro" : `Etapa ${etapa + 2} de 5`} · {ETAPAS[etapa]}</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((etapa + 2) / 5) * 100}%` }} /></div>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{ETAPAS[etapa]}</h1>
      </div>

      {etapa === 0 && (
        <section className="card-soft flex flex-col gap-4 p-5">
          <div className={grid}>
            <Campo id="mae_nome" label="Nome completo" obrigatorio erro={erros.mae_nome}><input {...fm("mae_nome")} autoComplete="name" /></Campo>
            <Campo id="cpf" label="CPF" obrigatorio erro={erros.cpf}><input {...fm("cpf")} inputMode="numeric" onChange={(e) => setM({ ...m, cpf: fmtCPF(e.target.value) })} /></Campo>
            <Campo id="mae_nascimento" label="Data de nascimento" obrigatorio erro={erros.mae_nascimento}><input {...fm("mae_nascimento")} type="date" /></Campo>
            <Campo id="mae_telefone" label="Telefone / WhatsApp" obrigatorio erro={erros.mae_telefone}><input {...fm("mae_telefone")} type="tel" onChange={(e) => setM({ ...m, mae_telefone: fmtTel(e.target.value) })} /></Campo>
            <Campo id="mae_email" label="E-mail" erro={erros.mae_email}><input {...fm("mae_email")} type="email" /></Campo>
            <Campo id="cep" label="CEP" obrigatorio dica="O endereço é preenchido automaticamente." erro={erros.cep}><input {...fm("cep")} inputMode="numeric" onChange={(e) => { const v = fmtCEP(e.target.value); setM({ ...m, cep: v }); buscarCEP(v); }} /></Campo>
            <Campo id="endereco" label="Endereço (rua e número)" obrigatorio erro={erros.endereco}><input {...fm("endereco")} autoComplete="street-address" /></Campo>
            <Campo id="bairro" label="Bairro" obrigatorio erro={erros.bairro}><input {...fm("bairro")} /></Campo>
            <Campo id="cidade" label="Cidade" obrigatorio erro={erros.cidade}><input {...fm("cidade")} /></Campo>
            <Campo id="uf" label="Estado" obrigatorio erro={erros.uf}>
              <select {...fm("uf")}><option value="">Selecione</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
            </Campo>
            <Campo id="estado_civil" label="Estado civil">
              <select {...fm("estado_civil")}><option value="">Selecione</option>{["Solteira(o)", "Casada / união estável", "Separada(o) / divorciada(o)", "Viúva(o)"].map((o) => <option key={o}>{o}</option>)}</select>
            </Campo>
            <Campo id="profissao" label="Profissão"><input {...fm("profissao")} /></Campo>
            <Campo id="quem_preenche" label="Quem está preenchendo" obrigatorio>
              <select {...fm("quem_preenche")}>{["A própria mãe / responsável", "Outro familiar", "Profissional ou voluntário do Centro"].map((o) => <option key={o}>{o}</option>)}</select>
            </Campo>
            <Campo id="emergencia_nome" label="Contato de emergência (nome)"><input {...fm("emergencia_nome")} /></Campo>
            <Campo id="emergencia_telefone" label="Contato de emergência (telefone)"><input {...fm("emergencia_telefone")} type="tel" onChange={(e) => setM({ ...m, emergencia_telefone: fmtTel(e.target.value) })} /></Campo>
          </div>
        </section>
      )}

      {etapa === 1 && (
        <section className="card-soft flex flex-col gap-4 p-5">
          <Aviso tom="blue">Esta etapa é opcional. Você pode continuar sem preencher.</Aviso>
          <div className={grid}>
            <Campo id="s_segundo_nome" label="Nome completo"><input {...fs("segundo_nome")} /></Campo>
            <Campo id="s_cpf" label="CPF" dica="Somente se necessário." erro={erros.s_cpf}><input {...fs("cpf")} inputMode="numeric" onChange={(e) => setS({ ...s, cpf: fmtCPF(e.target.value) })} /></Campo>
            <Campo id="s_segundo_nascimento" label="Data de nascimento"><input {...fs("segundo_nascimento")} type="date" /></Campo>
            <Campo id="s_segundo_telefone" label="Telefone" erro={erros.s_tel}><input {...fs("segundo_telefone")} type="tel" onChange={(e) => setS({ ...s, segundo_telefone: fmtTel(e.target.value) })} /></Campo>
            <Campo id="s_segundo_email" label="E-mail" erro={erros.s_email}><input {...fs("segundo_email")} type="email" /></Campo>
            <Campo id="s_segundo_profissao" label="Profissão"><input {...fs("segundo_profissao")} /></Campo>
            <Campo id="s_segundo_parentesco" label="Grau de parentesco com a criança">
              <select {...fs("segundo_parentesco")}><option value="">Selecione</option>{["Pai", "Mãe", "Avó / avô", "Tia / tio", "Padrasto / madrasta", "Responsável legal", "Outro"].map((o) => <option key={o}>{o}</option>)}</select>
            </Campo>
          </div>
        </section>
      )}

      {etapa === 2 && (
        <div className="flex flex-col gap-4">
          {filhos.map((k, i) => (
            <section key={i} className="card-soft flex flex-col gap-4 p-5" aria-label={`Filho ${i + 1}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold">Filho(a) {i + 1}{k.nome ? `: ${k.nome.split(" ")[0]}` : ""}</h2>
                {filhos.length > 1 && <button type="button" onClick={() => setFilhos(filhos.filter((_, j) => j !== i))} className="tap inline-flex items-center gap-1 rounded-full px-3 text-sm font-semibold text-emergency"><Trash2 className="h-4 w-4" /> Remover</button>}
              </div>
              <div className={grid}>
                <Campo id={`k${i}_nome`} label="Nome completo" obrigatorio erro={erros[`k${i}_nome`]}><input id={`k${i}_nome`} className={inputCls} value={k.nome} onChange={(e) => setK(i, { nome: e.target.value })} aria-invalid={!!erros[`k${i}_nome`]} /></Campo>
                <Campo id={`k${i}_nasc`} label="Data de nascimento" obrigatorio erro={erros[`k${i}_nasc`]}><input id={`k${i}_nasc`} type="date" className={inputCls} value={k.nascimento} onChange={(e) => setK(i, { nascimento: e.target.value })} aria-invalid={!!erros[`k${i}_nasc`]} /></Campo>
                <Campo id={`k${i}_sexo`} label="Sexo"><select id={`k${i}_sexo`} className={inputCls} value={k.sexo} onChange={(e) => setK(i, { sexo: e.target.value })}><option value="">Selecione</option><option>Feminino</option><option>Masculino</option><option>Prefiro não informar</option></select></Campo>
                <Campo id={`k${i}_cpf`} label="CPF da criança" dica="Se já tiver." erro={erros[`k${i}_cpf`]}><input id={`k${i}_cpf`} inputMode="numeric" className={inputCls} value={k.cpf} onChange={(e) => setK(i, { cpf: fmtCPF(e.target.value) })} /></Campo>
              </div>
              <div className="flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-warning" /><span>Os campos abaixo são de saúde: todos opcionais e com acesso restrito ao administrador.</span></div>
              <fieldset className="flex flex-col gap-2"><legend className="mb-2 text-sm font-semibold text-navy">Diagnóstico ou condição informada pela família</legend>
                <Opcoes nome="Diagnóstico" multi valores={DIAGNOSTICOS} valor={k.diagnosticos} onChange={(v) => setK(i, { diagnosticos: v })} /></fieldset>
              <div className={grid}>
                {k.diagnosticos.includes("Outra condição") && <Campo id={`k${i}_outro`} label="Qual condição?"><input id={`k${i}_outro`} className={inputCls} value={k.diagnostico_outro} onChange={(e) => setK(i, { diagnostico_outro: e.target.value })} /></Campo>}
                <Campo id={`k${i}_dd`} label="Data do diagnóstico"><input id={`k${i}_dd`} type="date" className={inputCls} value={k.data_diagnostico} onChange={(e) => setK(i, { data_diagnostico: e.target.value })} /></Campo>
                <Campo id={`k${i}_prof`} label="Profissional responsável"><input id={`k${i}_prof`} className={inputCls} value={k.profissional} onChange={(e) => setK(i, { profissional: e.target.value })} /></Campo>
              </div>
              {([["usa_medicacao", "Utiliza medicação?"], ["acompanhamento", "Faz acompanhamento terapêutico?"], ["frequenta_escola", "Frequenta escola?"], ["possui_bpc", "Possui BPC?"], ["aguardando_bpc", "Está aguardando avaliação ou concessão do BPC?"]] as const).map(([key, lab]) => (
                <fieldset key={key}><legend className="mb-2 text-sm font-semibold text-navy">{lab}</legend><Opcoes nome={lab} valores={["Sim", "Não"]} valor={k[key]} onChange={(v) => setK(i, { [key]: v } as any)} /></fieldset>
              ))}
              {k.acompanhamento === "Sim" && <fieldset><legend className="mb-2 text-sm font-semibold text-navy">Quais terapias realiza?</legend><Opcoes nome="Terapias" multi valores={TERAPIAS} valor={k.terapias} onChange={(v) => setK(i, { terapias: v })} /></fieldset>}
              {k.frequenta_escola === "Sim" && <Campo id={`k${i}_esc`} label="Nome da instituição de ensino"><input id={`k${i}_esc`} className={inputCls} value={k.escola} onChange={(e) => setK(i, { escola: e.target.value })} /></Campo>}
              <Campo id={`k${i}_nec`} label="Necessidades específicas de apoio"><textarea id={`k${i}_nec`} className={textareaCls} value={k.necessidades} onChange={(e) => setK(i, { necessidades: e.target.value })} maxLength={600} /></Campo>
              <Campo id={`k${i}_obs`} label="Observações adicionais"><textarea id={`k${i}_obs`} className={textareaCls} value={k.observacoes} onChange={(e) => setK(i, { observacoes: e.target.value })} maxLength={600} /></Campo>
            </section>
          ))}
          <Btn v="outline" type="button" onClick={() => setFilhos([...filhos, filhoVazio()])} className="self-start"><Plus className="h-5 w-5" /> Adicionar outro filho(a)</Btn>
        </div>
      )}

      {etapa === 3 && (
        <div className="flex flex-col gap-4">
          <section className="card-soft flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold">Confira os dados</h2><button className="text-sm font-semibold text-primary" onClick={() => setEtapa(0)}>Corrigir</button></div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Responsável</dt><dd>{m.mae_nome}</dd>
              <dt className="text-muted-foreground">CPF</dt><dd>{m.cpf}</dd>
              <dt className="text-muted-foreground">Telefone</dt><dd>{m.mae_telefone}</dd>
              <dt className="text-muted-foreground">Endereço</dt><dd>{m.endereco}, {m.bairro} · {m.cidade}/{m.uf} · {m.cep}</dd>
              {s.segundo_nome && <><dt className="text-muted-foreground">Segundo responsável</dt><dd>{s.segundo_nome} ({s.segundo_parentesco || "—"})</dd></>}
              <dt className="text-muted-foreground">Filhos</dt><dd>{filhos.map((k) => `${k.nome} (${idade(k.nascimento) ?? "?"} anos)`).join(" · ")}</dd>
            </dl>
          </section>
          <fieldset className="card-soft flex flex-col gap-1 p-5">
            <legend className="sr-only">Consentimentos</legend>
            <h2 className="mb-2 font-display text-xl font-bold">Consentimentos (LGPD)</h2>
            {([
              ["termos", <>Li e aceito os <Link to="/termos" target="_blank" className="font-semibold text-primary underline">Termos de uso</Link> e a <Link to="/privacidade" target="_blank" className="font-semibold text-primary underline">Política de privacidade</Link> (versão {TERMOS_VERSAO}). <b>Obrigatório.</b></>, !editando],
              ["dados", <>Autorizo o tratamento dos meus dados pessoais para o cadastro e o acolhimento da minha família. <b>Obrigatório.</b></>, !editando],
              ["resp", <>Declaro ser responsável legal pela(s) criança(s) ou ter autorização, e autorizo o tratamento dos dados delas no melhor interesse da criança (LGPD, art. 14). <b>Obrigatório.</b></>, !editando],
              ["saude", <><b>Consentimento específico para dados de saúde:</b> autorizo o tratamento das informações de saúde que informei, com acesso restrito e nunca para publicidade.{temSaude ? " Obrigatório porque você preencheu dados de saúde." : ""}</>, true],
              ["com", <>Aceito receber comunicados, eventos e novidades. <span className="text-muted-foreground">Opcional.</span></>, !editando],
            ] as const).filter((x) => x[2]).map(([k, txt]) => (
              <div key={k}>
                <label className="flex cursor-pointer items-start gap-3 py-2">
                  <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[var(--color-primary)]" checked={(c as any)[k]} onChange={(e) => setC({ ...c, [k]: e.target.checked })} aria-invalid={!!erros[k]} />
                  <span className="text-sm">{txt}</span>
                </label>
                {erros[k] && <p className="pl-9 text-sm font-semibold text-emergency" role="alert">{erros[k]}</p>}
              </div>
            ))}
          </fieldset>
        </div>
      )}

      <div className="no-print flex flex-wrap justify-between gap-3">
        {etapa > 0 ? <Btn v="outline" onClick={() => setEtapa(etapa - 1)}>← Voltar</Btn> : <span />}
        <div className="flex gap-2">
          {etapa === 1 && <Btn v="ghost" onClick={() => { setS(Object.fromEntries(Object.keys(s).map((k) => [k, ""])) as any); setEtapa(2); }}>Pular</Btn>}
          {etapa < 3 ? <Btn onClick={() => validar() && setEtapa(etapa + 1)}>Continuar →</Btn> : <Btn onClick={salvar} disabled={salvando} className="min-h-14 px-7">{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Confirmar e salvar cadastro"}</Btn>}
        </div>
      </div>
    </div>
  );
}
