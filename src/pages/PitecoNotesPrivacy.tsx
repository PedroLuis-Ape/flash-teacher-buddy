import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, FileText, ShieldCheck, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const UPDATED_AT = "10 de setembro de 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
        {children}
      </div>
    </section>
  );
}

export default function PitecoNotesPrivacy() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Política de Privacidade — Piteco Notes | APE Education";

    const description =
      "Política de Privacidade da extensão Piteco Notes para a Chrome Web Store.";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== undefined) meta.content = previousDescription;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Piteco Notes · Chrome Web Store
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Política de Privacidade — Piteco Notes
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            Esta política explica como a extensão Piteco Notes, da APE Education / App Piteco,
            utiliza informações necessárias para oferecer recursos de anotações e apoio aos estudos.
          </p>
          <p className="text-sm text-muted-foreground">Última atualização: {UPDATED_AT}.</p>
        </div>

        <Card className="mt-8 border-primary/15">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
            <div className="flex gap-3">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Notas de estudo</p>
                <p className="mt-1 text-sm text-muted-foreground">Conteúdo salvo por ação do usuário.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Leitura por voz</p>
                <p className="mt-1 text-sm text-muted-foreground">TTS para auxiliar estudo e pronúncia.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Uso limitado</p>
                <p className="mt-1 text-sm text-muted-foreground">Dados usados apenas para as funções da extensão.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-10 space-y-10">
          <Section title="1. Finalidade da extensão">
            <p>
              A Piteco Notes é uma ferramenta educacional para salvar textos, imagens e anotações
              escolhidos pelo usuário enquanto navega, organizar esse conteúdo para revisão e permitir
              a leitura de textos por voz por meio de recursos de Text-to-Speech (TTS).
            </p>
            <p>
              A extensão não tem como finalidade monitorar a navegação do usuário, criar perfis de
              publicidade ou vender informações pessoais.
            </p>
          </Section>

          <Section title="2. Informações que podem ser processadas">
            <p>
              A extensão pode processar o conteúdo que o próprio usuário decide utilizar em uma ação,
              como texto selecionado, imagens escolhidas para salvar, anotações digitadas e preferências
              necessárias ao funcionamento da extensão.
            </p>
            <p>
              Para executar ações solicitadas pelo usuário, a extensão também pode acessar temporariamente
              o conteúdo da página ativa. Esse acesso é utilizado somente para a funcionalidade acionada,
              como salvar uma seleção ou disponibilizar uma ferramenta de estudo.
            </p>
          </Section>

          <Section title="3. Armazenamento">
            <p>
              Notas, conteúdos salvos e preferências podem ser armazenados pelos mecanismos de armazenamento
              disponibilizados pelo navegador para manter a experiência entre sessões. A extensão solicita
              somente o acesso necessário para oferecer suas funções de organização e estudo.
            </p>
            <p>
              A APE Education não vende dados armazenados pela extensão e não os utiliza para publicidade
              comportamental, avaliação de crédito ou finalidades incompatíveis com o propósito educacional
              informado nesta política.
            </p>
          </Section>

          <Section title="4. Text-to-Speech (TTS)">
            <p>
              Quando o usuário solicita a leitura de uma palavra, frase ou texto, a extensão utiliza o recurso
              de TTS disponível no navegador ou no mecanismo de voz configurado no dispositivo. O conteúdo é
              processado somente na medida necessária para executar a leitura solicitada.
            </p>
          </Section>

          <Section title="5. Permissões do navegador">
            <p>
              Permissões como acesso temporário à aba ativa, menu de contexto, execução de scripts na página
              ativa, armazenamento e TTS são utilizadas para permitir que o usuário capture conteúdo, salve
              notas e use recursos de voz. Permissões de host, quando presentes, servem para disponibilizar
              essas funções nas páginas em que o usuário escolhe utilizar a extensão.
            </p>
            <p>
              Essas permissões não autorizam a venda de dados nem alteram o compromisso de uso limitado
              descrito nesta política.
            </p>
          </Section>

          <Section title="6. Compartilhamento de dados">
            <p>
              A Piteco Notes não vende dados pessoais. Informações não são transferidas a terceiros para
              publicidade personalizada, criação de perfis comerciais ou finalidades de crédito.
            </p>
            <p>
              Caso uma função dependa de um serviço técnico necessário para sua execução, o tratamento deve
              ficar limitado ao mínimo necessário para entregar essa função e sujeito às proteções aplicáveis.
            </p>
          </Section>

          <Section title="7. Controle do usuário e exclusão">
            <p>
              O usuário pode excluir conteúdos salvos utilizando os controles disponíveis na extensão e pode
              remover a extensão do navegador a qualquer momento. A remoção de dados mantidos pelo próprio
              navegador também pode depender dos controles de armazenamento oferecidos pelo Chrome ou pelo
              sistema utilizado.
            </p>
          </Section>

          <Section title="8. Crianças, alunos e uso educacional">
            <p>
              A extensão foi criada como ferramenta de apoio aos estudos. Professores, responsáveis e
              instituições devem orientar o uso conforme as regras aplicáveis ao seu contexto educacional,
              especialmente quando houver usuários menores de idade.
            </p>
          </Section>

          <Section title="9. Alterações desta política">
            <p>
              Esta política pode ser atualizada quando houver mudanças relevantes nas funcionalidades,
              permissões ou práticas de tratamento de dados da extensão. A data da versão mais recente será
              sempre exibida no início desta página.
            </p>
          </Section>

          <Section title="10. Contato">
            <p>
              Para dúvidas sobre esta política ou sobre a Piteco Notes, utilize os canais oficiais da APE
              Education no site do App Piteco.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild variant="outline">
                <Link to="/reportar-problema">Entrar em contato</Link>
              </Button>
              <Button asChild variant="ghost">
                <a href="https://www.apeeducation.org/" target="_blank" rel="noreferrer">
                  Site oficial <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </Section>
        </div>

        <div className="mt-12 border-t pt-6 text-sm leading-6 text-muted-foreground">
          <p>
            APE — Apprentice Practice & Enhancement (App Piteco). Esta página é pública e pode ser usada
            como URL de Política de Privacidade na listagem da Piteco Notes na Chrome Web Store.
          </p>
        </div>
      </div>
    </main>
  );
}
