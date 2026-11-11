import { marked } from 'marked';
import { useMemo } from 'react';

/** Renderiza documentación propia del repositorio (contenido de confianza, no de usuarios). */
export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => marked.parse(source, { async: false }) as string, [source]);
  return <article className="doc" dangerouslySetInnerHTML={{ __html: html }} />;
}
