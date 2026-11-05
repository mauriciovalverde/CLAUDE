# Centro de Acolhimento à Família Atípica

App e site para mães e famílias de crianças atípicas: orientações, BPC, direitos, diário da criança
(no estilo Nello), busca de especialistas com mapa, rotina com lembretes, rede de apoio no WhatsApp
e painel administrativo com aprovação de cadastros e disparos.

- **Publicado em:** https://mauriciovalverde.github.io/CLAUDE/
- **Backend:** Lovable Cloud (Supabase) do projeto "Acolhe Família Atípica", com RLS em todas as tabelas.
- **Administrador:** quem se cadastrar com `perifest@gmail.com` recebe o papel de admin automaticamente.

## Rodar localmente

```bash
npm install
npm run dev
```

## Publicação

Cada push na branch `main` gera o build e publica no GitHub Pages (`.github/workflows/pages.yml`).
Para lojas (Google Play / App Store), veja `docs/PUBLICACAO-LOJAS.md`.

## Estrutura

- `src/routes/` — telas (roteamento por arquivo, TanStack Router)
- `src/components/app/` — layout, kit visual, mapa
- `src/components/admin/` — módulos do painel administrativo
- `src/lib/` — autenticação, acesso a dados, validações brasileiras (CPF, telefone, CEP), conteúdo padrão
