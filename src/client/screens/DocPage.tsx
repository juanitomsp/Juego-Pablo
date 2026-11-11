import { go } from '../App';
import { Markdown } from '../components/Markdown';

export function DocPage({ title, source }: { title: string; source: string }) {
  return (
    <main className="page">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← Inicio
        </button>
        <span>{title}</span>
      </nav>
      <Markdown source={source} />
    </main>
  );
}
