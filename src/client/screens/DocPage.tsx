import { go } from '../App';
import { Markdown } from '../components/Markdown';
import { t } from '../i18n';

export function DocPage({ title, source }: { title: string; source: string }) {
  return (
    <main className="page">
      <nav className="topnav">
        <button className="link" onClick={() => go('/')}>
          ← {t('Inicio')}
        </button>
        <span>{title}</span>
      </nav>
      <Markdown source={source} />
    </main>
  );
}
