import { SEOPage } from "@/components/seo/SEOPage";

export default function AtividadesDeIngles() {
  return (
    <SEOPage
      title="Atividades de Inglês com Tradução, Frases e Vocabulário | APE"
      description="Encontre atividades de inglês para praticar vocabulário, gramática, tradução, frases e revisão ativa."
      path="/atividades-de-ingles"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: "Atividades de Inglês — APE",
        inLanguage: "pt-BR",
        learningResourceType: "InteractiveResource",
        url: "https://www.apeeducation.org/atividades-de-ingles",
      }}
      h1="Atividades de Inglês para Estudar com Mais Prática"
      intro="O APE reúne diferentes atividades de inglês para que cada habilidade seja exercitada de forma específica: tradução, vocabulário, frases, gramática e revisão ativa."
      sections={[
        {
          title: "Tipos de atividades",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Tradução:</strong> traduza palavras e frases do inglês para o português e vice-versa.</li>
              <li><strong>Lacunas:</strong> complete frases com a palavra correta.</li>
              <li><strong>Frases:</strong> trabalhe orações curtas com vocabulário em contexto.</li>
              <li><strong>Vocabulário:</strong> aprenda palavras novas com áudio e dicas.</li>
              <li><strong>Gramática:</strong> reforce estruturas com listas temáticas.</li>
              <li><strong>Revisão:</strong> volte às palavras que você errou para fixar de verdade.</li>
              <li><strong>Jogos:</strong> use modos interativos para tornar a prática mais leve.</li>
            </ul>
          ),
        },
        {
          title: "Como o APE estrutura a prática",
          body: (
            <p>
              Cada lista de estudo pode ser usada em diferentes modos. Você começa com um conteúdo
              (por exemplo, uma lista de vocabulário) e escolhe entre flashcards, escrita ou múltipla
              escolha. O mesmo conteúdo pode ser revisitado de várias formas, o que ajuda a fixar
              melhor do que repetir sempre o mesmo formato.
            </p>
          ),
        },
        {
          title: "Para alunos e professores",
          body: (
            <p>
              Alunos podem usar o APE para reforço individual; professores podem montar listas
              próprias e compartilhá-las com turmas. Tudo segue uma proposta de prática ativa de
              frases em inglês e vocabulário em inglês.
            </p>
          ),
        },
      ]}
      finalCta={{
        title: "Quer experimentar as atividades?",
        text: "Crie um acesso e comece a praticar inglês com diferentes tipos de exercício.",
      }}
    />
  );
}