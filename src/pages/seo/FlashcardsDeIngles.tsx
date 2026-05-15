import { SEOPage } from "@/components/seo/SEOPage";

export default function FlashcardsDeIngles() {
  return (
    <SEOPage
      title="Flashcards de Inglês para Vocabulário e Frases | APE"
      description="Use flashcards de inglês para revisar vocabulário, memorizar frases e praticar com jogos de estudo ativo."
      path="/flashcards-de-ingles"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: "Flashcards de Inglês — APE",
        inLanguage: "pt-BR",
        learningResourceType: "Flashcard",
        url: "https://www.apeeducation.org/flashcards-de-ingles",
      }}
      h1="Flashcards de Inglês para Memorizar Vocabulário e Frases"
      intro="Flashcards são uma das formas mais eficazes de revisão ativa. No APE, você cria, organiza e estuda cartões com vocabulário em inglês e prática de frases."
      sections={[
        {
          title: "Por que flashcards funcionam",
          body: (
            <p>
              A revisão ativa força o cérebro a recuperar a informação, em vez de apenas reconhecer.
              Esse esforço de lembrança é o que consolida o aprendizado. Os flashcards de inglês do
              APE foram pensados para usar esse princípio em sessões curtas e diárias.
            </p>
          ),
        },
        {
          title: "Modos de estudo disponíveis",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Flip:</strong> veja o termo, tente lembrar e vire o cartão.</li>
              <li><strong>Escrita:</strong> digite a palavra ou frase em inglês.</li>
              <li><strong>Múltipla escolha:</strong> reconheça a tradução correta entre alternativas.</li>
              <li><strong>Revisão de difíceis:</strong> volte às palavras marcadas como difíceis com prioridade.</li>
            </ul>
          ),
        },
        {
          title: "Crie suas próprias listas",
          body: (
            <p>
              Você pode importar listas em lote ou criar manualmente, com imagens, áudio e dicas. As
              listas podem ser organizadas em pastas e compartilhadas com turmas, quando aplicável.
            </p>
          ),
        },
      ]}
      finalCta={{
        title: "Quer começar com flashcards?",
        text: "Crie um acesso e monte sua primeira lista de flashcards de inglês.",
      }}
    />
  );
}