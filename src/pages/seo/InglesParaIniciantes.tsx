import { SEOPage } from "@/components/seo/SEOPage";

export default function InglesParaIniciantes() {
  return (
    <SEOPage
      title="Inglês para Iniciantes com Atividades e Flashcards | APE"
      description="Pratique inglês básico com vocabulário, frases simples, tradução, flashcards e atividades guiadas para iniciantes."
      path="/ingles-para-iniciantes"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: "Inglês para Iniciantes — APE",
        inLanguage: "pt-BR",
        learningResourceType: "InteractiveResource",
        educationalLevel: "Beginner",
        url: "https://www.apeeducation.org/ingles-para-iniciantes",
        about: "Inglês para iniciantes com flashcards, vocabulário e prática ativa.",
      }}
      h1="Inglês para Iniciantes com Prática Ativa"
      intro="O APE ajuda iniciantes a praticar inglês de forma estruturada: vocabulário, frases simples, tradução e revisão com atividades guiadas que se repetem com frequência adequada para fixação."
      sections={[
        {
          title: "Por onde começar",
          body: (
            <>
              <p>
                Para quem está começando do zero, o caminho mais eficaz é montar um vocabulário base
                e praticar frases curtas em inglês todos os dias. O APE oferece listas iniciais
                organizadas por tema, com áudio e dicas, para que cada palavra entre em contexto.
              </p>
              <p>
                Os flashcards de inglês permitem revisar o que você acabou de ver e voltar ao mesmo
                conteúdo em sessões curtas, o que ajuda a memória a longo prazo.
              </p>
            </>
          ),
        },
        {
          title: "Atividades indicadas para o nível básico",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Tradução guiada com palavras frequentes do inglês cotidiano.</li>
              <li>Múltipla escolha para reconhecer o significado correto.</li>
              <li>Escrita simples para fixar a forma das palavras.</li>
              <li>Revisão ativa de palavras difíceis na lista vermelha.</li>
            </ul>
          ),
        },
        {
          title: "Como manter constância",
          body: (
            <p>
              Estudar 10 a 15 minutos por dia é mais eficiente do que sessões longas e esporádicas.
              Use as metas para definir um ritmo realista e acompanhar sua evolução semana a semana.
            </p>
          ),
        },
      ]}
      finalCta={{
        title: "Pronto para começar a praticar?",
        text: "Crie seu acesso e comece com listas iniciais de vocabulário em inglês.",
      }}
    />
  );
}