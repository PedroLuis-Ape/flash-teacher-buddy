import { SEOPage } from "@/components/seo/SEOPage";

export default function ParaProfessores() {
  return (
    <SEOPage
      title="Plataforma para Professores de Inglês | APE"
      description="Crie listas, organize atividades, compartilhe materiais e acompanhe alunos com uma plataforma para professores de inglês."
      path="/para-professores"
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Plataforma para Professores de Inglês — APE",
        inLanguage: "pt-BR",
        url: "https://www.apeeducation.org/para-professores",
        audience: {
          "@type": "EducationalAudience",
          educationalRole: "teacher",
        },
      }}
      h1="Plataforma para Professores de Inglês"
      intro="O APE foi pensado também para quem ensina. Professores podem criar listas, organizar materiais por turma, compartilhar conteúdos e acompanhar o estudo dos alunos."
      sections={[
        {
          title: "O que professores podem fazer",
          body: (
            <ul className="list-disc pl-5 space-y-2">
              <li>Criar listas de vocabulário, frases e atividades de inglês.</li>
              <li>Importar conteúdo em lote a partir de planilhas e textos.</li>
              <li>Organizar materiais em pastas por turma, nível ou tema.</li>
              <li>Compartilhar conteúdos públicos no portal.</li>
              <li>Criar turmas e acompanhar o progresso dos alunos.</li>
              <li>Definir metas e revisar o desempenho de cada estudante.</li>
            </ul>
          ),
        },
        {
          title: "Pensado para a rotina da sala de aula",
          body: (
            <p>
              As atividades funcionam tanto como reforço em casa quanto como apoio durante a aula.
              O foco é prática ativa de inglês, sem promessas exageradas: o aluno avança porque
              estuda com constância, e o professor consegue enxergar onde precisa apoiar mais.
            </p>
          ),
        },
        {
          title: "Materiais públicos e privados",
          body: (
            <p>
              Materiais privados ficam acessíveis apenas para você e suas turmas. Conteúdos
              compartilhados publicamente aparecem no <a href="/portal" className="underline">portal público</a>,
              o que ajuda outros alunos e professores a descobrir seu trabalho.
            </p>
          ),
        },
      ]}
      finalCta={{
        title: "Comece a montar suas listas",
        text: "Crie um acesso de professor e estruture seus materiais de inglês em poucos minutos.",
      }}
    />
  );
}