import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold mb-4 font-display">Página não encontrada</h2>
      <p className="text-slate-400 mb-6">Não conseguimos encontrar o conteúdo solicitado.</p>
      <Link 
        href="/"
        className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium text-sm"
      >
        Voltar para o Início
      </Link>
    </div>
  );
}
