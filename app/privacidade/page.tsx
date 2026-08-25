import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, FileText, Database, Server, RefreshCw } from 'lucide-react';
import MistikaLogo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Workshop Canva com IA',
  description: 'Informações sobre como coletamos, usamos e protegemos os seus dados pessoais de acordo com a LGPD.',
};

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#070b13] text-slate-200 antialiased selection:bg-primary selection:text-white">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -left-32 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between gap-4 mb-10 pb-6 border-b border-white/10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/5"
          >
            <ArrowLeft className="size-4" />
            <span>Voltar ao início</span>
          </Link>
          <div className="scale-90 sm:scale-100">
            <MistikaLogo size="md" />
          </div>
        </div>

        {/* Title banner */}
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="size-3.5" />
            <span>Transparência e Segurança</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
            Política de Privacidade
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Última atualização: 25 de Agosto de 2026. Esta política descreve como tratamos seus dados pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
          </p>
        </header>

        {/* Content sections */}
        <main className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-300">
          {/* Section 1 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-3 text-white font-bold text-lg">
              <Eye className="size-5 text-primary shrink-0" />
              <h2>1. Informações que Coletamos</h2>
            </div>
            <p>
              Ao utilizar a plataforma do <strong>Workshop Canva com IA</strong>, podemos coletar as seguintes categorias de informações:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 marker:text-primary">
              <li>
                <strong className="text-white">Dados de Identificação e Cadastro:</strong> Nome completo, endereço de e-mail e senha criptografada criados no momento do cadastro ou acesso.
              </li>
              <li>
                <strong className="text-white">Dados de Progresso e Utilização:</strong> Aulas concluídas, respostas a exercícios, anotações de evolução e interações na comunidade interna.
              </li>
              <li>
                <strong className="text-white">Consultoria e Interações com IA:</strong> Dúvidas e mensagens enviadas à Consultora Virtual Lyra para fins exclusivos de processamento e busca nas apostilas do workshop.
              </li>
              <li>
                <strong className="text-white">Dados Técnicos e Navegação:</strong> Informações de dispositivo, navegador, endereço IP e data/hora de acesso para garantia de segurança e prevenção a fraudes.
              </li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-3 text-white font-bold text-lg">
              <FileText className="size-5 text-primary shrink-0" />
              <h2>2. Finalidade do Tratamento dos Dados</h2>
            </div>
            <p>
              Utilizamos as informações coletadas estritamente para os seguintes propósitos:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 marker:text-primary">
              <li>Liberar e gerenciar seu acesso aos materiais didáticos, vídeos, apostilas em PDF e atualizações do workshop.</li>
              <li>Salvar seu progresso individual nas lições e no plano de estudos.</li>
              <li>Processar e responder dúvidas via inteligência artificial fundamentada no material oficial.</li>
              <li>Enviar comunicações essenciais sobre o workshop, avisos de novas aulas ou recuperação de senha.</li>
              <li>Cumprir obrigações legais e garantir a proteção contra acessos não autorizados.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-3 text-white font-bold text-lg">
              <Lock className="size-5 text-primary shrink-0" />
              <h2>3. Segurança e Armazenamento</h2>
            </div>
            <p>
              Adotamos práticas e padrões rigorosos de segurança da informação para proteger seus dados pessoais:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 marker:text-primary">
              <li>
                <strong className="text-white">Criptografia:</strong> Toda a comunicação entre seu navegador e a plataforma é protegida via protocolo HTTPS/TLS, e senhas são criptografadas antes do armazenamento.
              </li>
              <li>
                <strong className="text-white">Infraestrutura em Nuvem Confiável:</strong> Utilizamos provedores de nuvem certificados com controle estrito de acesso e proteção por políticas de segurança a nível de linha (RLS).
              </li>
              <li>
                <strong className="text-white">Não Comercialização:</strong> Nunca vendemos, alugamos ou comercializamos seus dados pessoais com terceiros para fins de marketing ou publicidade.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-3 text-white font-bold text-lg">
              <Server className="size-5 text-primary shrink-0" />
              <h2>4. Compartilhamento com Terceiros</h2>
            </div>
            <p>
              O compartilhamento de dados é restrito a provedores de serviços tecnológicos essenciais para a operação da plataforma:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 marker:text-primary">
              <li>
                <strong className="text-white">Processamento de Autenticação e Banco de Dados:</strong> Provedor Supabase para armazenamento seguro de credenciais e progresso.
              </li>
              <li>
                <strong className="text-white">Serviços de IA e Busca Vetorial:</strong> APIs especializadas (como OpenAI) para geração de embeddings e respostas, transmitindo unicamente a dúvida técnica para localização dos trechos das apostilas.
              </li>
              <li>
                <strong className="text-white">Processamento de Pagamento:</strong> Plataformas financeiras integradas (como Mercado Pago) responsáveis pelo processamento seguro de transações.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-3 text-white font-bold text-lg">
              <Database className="size-5 text-primary shrink-0" />
              <h2>5. Seus Direitos (LGPD)</h2>
            </div>
            <p>
              Nos termos do Artigo 18 da LGPD, você possui direito a:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-300 marker:text-primary">
              <li>Confirmar a existência de tratamento e acessar seus dados pessoais cadastrados.</li>
              <li>Solicitar a correção de dados incompletos, inexatos ou desatualizados.</li>
              <li>Solicitar a exclusão ou anonimização de dados desnecessários ou tratados em desconformidade.</li>
              <li>Revogar seu consentimento a qualquer momento.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-md space-y-3">
            <div className="flex items-center gap-3 text-white font-bold text-lg">
              <RefreshCw className="size-5 text-primary shrink-0" />
              <h2>6. Alterações e Contato</h2>
            </div>
            <p>
              Podemos atualizar esta Política de Privacidade periodicamente para refletir melhorias no serviço ou exigências legais. A versão atualizada sempre indicará a data da última revisão no topo da página.
            </p>
            <p>
              Para dúvidas, solicitações ou exercício de seus direitos relacionados aos dados pessoais, entre em contato através do canal de suporte da plataforma ou pelo e-mail do organizador do workshop.
            </p>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-white/10 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Workshop Canva com IA. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
