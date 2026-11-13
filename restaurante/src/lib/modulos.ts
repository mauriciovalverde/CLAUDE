import { BarChart3, Fingerprint, UserRoundCheck, Bot, Box, Calculator, ClipboardList, FileText, GitCompareArrows, HandHeart, HelpCircle, Settings, ShoppingBasket, ShoppingCart, Store, Users, UsersRound, Wallet } from 'lucide-react';
import type { Papel } from './sessao';

// Blocos da tela principal (cores pastel da referência) e quem pode ver cada um.
export const MODULOS: { id: string; t: string; i: any; cor: string; tinta: string; papeis: Papel[]; desc: string }[] = [
  { id: 'meu-ponto', t: 'Meu ponto', i: Fingerprint, cor: 'bg-[#FFE1D6]', tinta: 'text-[#8A2E12]', papeis: ['solicitante', 'compras', 'estoque', 'caixa', 'admin'], desc: 'Bater ponto e espelho' },
  { id: 'pedir', t: 'Pedir produtos', i: ShoppingCart, cor: 'bg-[#FBE3C6]', tinta: 'text-[#8A4B12]', papeis: ['solicitante', 'compras', 'estoque', 'caixa'], desc: 'Escolher e enviar' },
  { id: 'compras', t: 'Compras', i: ShoppingBasket, cor: 'bg-[#EADFC9]', tinta: 'text-[#5B4A2E]', papeis: ['compras'], desc: 'Registrar e receber' },
  { id: 'solicitacoes', t: 'Solicitações', i: ClipboardList, cor: 'bg-[#D3E7CC]', tinta: 'text-[#35552E]', papeis: ['compras'], desc: 'Aprovar pedidos' },
  { id: 'fornecedores', t: 'Fornecedores', i: UsersRound, cor: 'bg-[#CDF3E3]', tinta: 'text-[#22604A]', papeis: ['compras'], desc: 'Cadastro e preços' },
  { id: 'fechamento', t: 'Fechamento', i: Calculator, cor: 'bg-[#F3D0EC]', tinta: 'text-[#6E3463]', papeis: ['caixa'], desc: 'Caixa do turno' },
  { id: 'notas', t: 'Notas fiscais', i: FileText, cor: 'bg-[#E8C9BC]', tinta: 'text-[#6B3E2C]', papeis: ['compras'], desc: 'Foto e conferência' },
  { id: 'estoque', t: 'Estoque', i: Box, cor: 'bg-[#FDE3C3]', tinta: 'text-[#7A4A17]', papeis: ['estoque', 'compras'], desc: 'Saldo e inventário' },
  { id: 'dashboard', t: 'Dashboard', i: BarChart3, cor: 'bg-[#E9DBF5]', tinta: 'text-[#5A3F78]', papeis: ['admin'], desc: 'Visão do restaurante' },
  { id: 'financeiro', t: 'Financeiro', i: Wallet, cor: 'bg-[#E7E4E2]', tinta: 'text-[#4B4644]', papeis: ['admin'], desc: 'Contas e fluxo de caixa' },
  { id: 'relatorios', t: 'Relatórios', i: HandHeart, cor: 'bg-[#CCD8F7]', tinta: 'text-[#2F4A8A]', papeis: ['admin'], desc: 'PDF e Excel' },
  { id: 'vendas', t: 'Vendas', i: Store, cor: 'bg-[#FFF0B8]', tinta: 'text-[#6B5A10]', papeis: ['admin'], desc: 'Faturamento' },
  { id: 'comparativo', t: 'Comparativo', i: GitCompareArrows, cor: 'bg-[#D7EEF3]', tinta: 'text-[#22566A]', papeis: ['admin'], desc: 'Mês contra mês' },
  { id: 'ia', t: 'Central IA', i: Bot, cor: 'bg-[#E3E8FF]', tinta: 'text-[#3A44A0]', papeis: ['admin'], desc: 'Escreva e a IA faz' },
  { id: 'ponto', t: 'Controle de ponto', i: UserRoundCheck, cor: 'bg-[#DCEBFA]', tinta: 'text-[#1F4E79]', papeis: ['admin'], desc: 'Jornada da equipe' },
  { id: 'equipe', t: 'Equipe', i: Users, cor: 'bg-[#F7DADA]', tinta: 'text-[#7A2A2A]', papeis: ['admin'], desc: 'Acessos e PINs' },
  { id: 'configuracoes', t: 'Configurações', i: Settings, cor: 'bg-[#ECECEC]', tinta: 'text-[#444]', papeis: ['solicitante', 'compras', 'estoque', 'caixa'], desc: 'Restaurante e PIN' },
  { id: 'ajuda', t: 'Ajuda', i: HelpCircle, cor: 'bg-[#E4F1E4]', tinta: 'text-[#2E5A2E]', papeis: ['solicitante', 'compras', 'estoque', 'caixa'], desc: 'Passo a passo' },
];
export const podeVer = (id: string, pode: (p: Papel) => boolean) => id === 'inicio' || !!MODULOS.find((m) => m.id === id)?.papeis.some((p) => pode(p));
