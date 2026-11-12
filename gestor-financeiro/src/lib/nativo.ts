// Integração com o aplicativo Android (Capacitor). No navegador, tudo cai no comportamento web normal.
import { Capacitor } from '@capacitor/core';

export const ehNativo = () => Capacitor.isNativePlatform();
/** Endereço público do app web (usado em links de e-mail e retornos do Google). */
export const URL_WEB = 'https://mauriciovalverde.github.io/CLAUDE/gestor/';
export const urlApp = () => (ehNativo() ? URL_WEB : window.location.origin + window.location.pathname);

/** Abre um link fora do app (o Google não permite login dentro de WebView). */
export async function abrirExterno(url: string) {
  if (!ehNativo()) { window.location.href = url; return; }
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}

/** Salva/compartilha um arquivo. No celular abre a tela de compartilhar (WhatsApp, Drive, e-mail...). */
export async function salvarArquivo(nome: string, base64: string, mime: string) {
  if (!ehNativo()) {
    const a = document.createElement('a');
    a.href = `data:${mime};base64,${base64}`; a.download = nome; a.click();
    return;
  }
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');
  const r = await Filesystem.writeFile({ path: nome, data: base64, directory: Directory.Cache });
  await Share.share({ title: nome, files: [r.uri], dialogTitle: 'Salvar ou enviar' });
}

/** Quando o usuário volta ao app (ex.: depois de autorizar o Google no navegador), avisa as telas para recarregar. */
export async function aoVoltarAoApp(fn: () => void) {
  if (!ehNativo()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('resume', fn);
}

/** Salva/compartilha um texto (UTF-8). */
export const salvarTexto = (nome: string, texto: string) => salvarArquivo(nome, btoa(unescape(encodeURIComponent(texto))), 'text/plain');
