# Como instalar a skill "Gestor Financeiro Inteligente" no Claude

O arquivo `gestor-financeiro-inteligente.zip` é uma **Skill do Claude**: um pacote de instruções, banco de dados e código de referência que ensina o Claude a construir e manter o sistema completo.

## No Claude (site ou app: claude.ai)
1. Abra **Configurações → Capacidades** (Settings → Capabilities) e ative **Skills** (e "Execução de código", se aparecer).
2. Em Skills, clique em **Enviar skill** (Upload skill) e escolha `gestor-financeiro-inteligente.zip`.
3. Abra uma conversa nova e escreva:
   > Use a skill gestor-financeiro-inteligente e construa o sistema completo para mim.

   Com o conector do Lovable ou do Supabase ativo, o Claude cria o projeto direto lá. Sem eles, ele gera o código para você publicar.

## No Claude Code (terminal ou app de código)
```bash
mkdir -p ~/.claude/skills
unzip gestor-financeiro-inteligente.zip -d ~/.claude/skills/
```
Depois, numa pasta vazia: `claude` → "Construa o Gestor Financeiro Inteligente usando a skill".

## O que vai ser pedido durante a construção
- Uma conta no Supabase (banco e login), grátis.
- Uma chave da API da Anthropic (para a IA do chat).
- Uma credencial OAuth do Google Cloud (para o Google Agenda). O passo a passo está na skill.

Nenhuma senha ou chave fica no código: tudo vai para os "secrets" do Supabase.
