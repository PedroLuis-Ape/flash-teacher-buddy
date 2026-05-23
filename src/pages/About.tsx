/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, BookOpen, Copyright, User } from "lucide-react";
import { SEOHead } from "@/components/seo/SEOHead";
import { PublicBackBar } from "@/components/seo/PublicBackBar";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Sobre o APE — Plataforma de Estudo Ativo"
        description="Conheça o APE, uma plataforma educacional de estudo ativo com flashcards, jogos, turmas e prática guiada de idiomas."
        path="/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "Sobre o APE",
          inLanguage: "pt-BR",
          url: "https://www.apeeducation.org/about",
          mainEntity: {
            "@type": "Organization",
            name: "APE",
            url: "https://www.apeeducation.org/",
          },
        }}
      />
      <PublicBackBar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">APE</h1>
          <p className="text-xl text-muted-foreground">
            Apprentice Practice & Enhancement
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Sobre o APE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              O <strong className="text-foreground">APE (Apprentice Practice & Enhancement)</strong> é 
              um aplicativo educacional focado em prática guiada de idiomas, desenvolvido por{" "}
              <strong className="text-foreground">Pedro Luis de Oliveira Silva</strong>.
            </p>
            <p>
              Todos os materiais visuais, fluxo de estudo, lógica de gamificação e recursos de 
              prática de voz, flashcards e turmas foram concebidos para uso exclusivo nas aulas 
              e projetos do autor.
            </p>
            <p>
              O sistema conta com múltiplos modos de estudo interativos, incluindo flashcards, 
              múltipla escolha, escrita, organização de palavras e prática de pronúncia com 
              reconhecimento de voz.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Autor
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>
              <strong className="text-foreground">Pedro Luis de Oliveira Silva</strong>
            </p>
            <p className="text-sm mt-2">
              Professor e desenvolvedor do aplicativo APE, dedicado a criar ferramentas 
              educacionais inovadoras para o ensino de idiomas.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Termos de Uso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Ao utilizar o APE, você concorda com os seguintes termos:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>O uso do aplicativo é restrito a alunos e usuários autorizados pelo autor.</li>
              <li>Todo o conteúdo criado pelo usuário permanece sob sua propriedade, porém o usuário concede ao APE licença de uso para fins de funcionamento do aplicativo.</li>
              <li>O aplicativo é fornecido "como está", sem garantias expressas ou implícitas.</li>
              <li>O autor reserva-se o direito de modificar, suspender ou descontinuar o serviço a qualquer momento.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copyright className="h-5 w-5 text-primary" />
              Direitos Autorais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              O código-fonte, layout, mascote Piteco, marca APE, lógica de progressão e demais 
              elementos deste aplicativo são protegidos por direitos autorais.
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm font-medium text-destructive">
                ⚠️ Não é permitido:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                <li>Copiar, redistribuir ou vender o aplicativo ou partes dele</li>
                <li>Reutilizar o código-fonte sem autorização expressa por escrito</li>
                <li>Modificar ou criar obras derivadas sem permissão</li>
                <li>Remover ou alterar avisos de direitos autorais</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            © 2025 APE – Apprentice Practice & Enhancement
          </p>
          <p>
            Desenvolvido por Pedro Luis de Oliveira Silva. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
