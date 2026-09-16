import { Check, Gamepad2, RotateCcw, Shuffle, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

type DemoCopy = {
  label: string;
  context: string;
  prompt: string;
  instruction: string;
  answerLabel: string;
  answer: string;
  caption: string;
};

type MiniGameRound = {
  prompt: string;
  context: string;
  correct: string;
  options: string[];
};

type RoundStatus = "idle" | "correct" | "wrong" | "complete";

interface LandingMiniGameProps {
  demo: DemoCopy;
  continueHref: string;
  locale?: string;
}

function rotate<T>(items: T[], amount: number): T[] {
  if (items.length < 2) return [...items];
  const normalized = ((amount % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function buildRounds(demo: DemoCopy, locale = "pt-BR"): MiniGameRound[] {
  const isPortuguese = locale.toLowerCase().startsWith("pt");

  if (!isPortuguese) {
    return [
      {
        prompt: demo.prompt,
        context: demo.context,
        correct: demo.answer,
        options: [demo.answer, "Where did you go yesterday?", "What time is your class?"],
      },
      {
        prompt: "I worked all morning.",
        context: "Past simple",
        correct: "I spent the whole morning working.",
        options: ["I spent the whole morning working.", "I will work tomorrow morning.", "I am sleeping now."],
      },
      {
        prompt: "Did you study yesterday?",
        context: "Question in the past",
        correct: "A question about a finished day in the past.",
        options: ["A question about a finished day in the past.", "A plan for tomorrow.", "A habit that always happens."],
      },
    ];
  }

  return [
    {
      prompt: demo.prompt,
      context: demo.context,
      correct: demo.answer,
      options: [demo.answer, "Como está o seu trabalho?", "Onde você foi ontem?"],
    },
    {
      prompt: "I worked all morning.",
      context: "Past simple • significado",
      correct: "Eu trabalhei a manhã toda.",
      options: ["Eu trabalhei a manhã toda.", "Eu vou trabalhar amanhã cedo.", "Eu estou dormindo agora."],
    },
    {
      prompt: "Did you study yesterday?",
      context: "Past simple • pergunta",
      correct: "Você estudou ontem?",
      options: ["Você estudou ontem?", "Você estuda todos os dias?", "Você vai estudar amanhã?"],
    },
  ];
}

export function LandingMiniGame({ demo, continueHref, locale }: LandingMiniGameProps) {
  const rounds = useMemo(() => buildRounds(demo, locale), [demo, locale]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [status, setStatus] = useState<RoundStatus>("idle");
  const [misses, setMisses] = useState(0);
  const [mixTick, setMixTick] = useState(0);
  const [options, setOptions] = useState(() => rotate(rounds[0].options, 1));
  const [selected, setSelected] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const current = rounds[roundIndex];
  const completedRounds = status === "complete" ? rounds.length : roundIndex;
  const isPortuguese = (locale ?? "pt-BR").toLowerCase().startsWith("pt");

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const schedule = (callback: () => void, delay: number) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(callback, delay);
  };

  const handleAnswer = (answer: string) => {
    if (status !== "idle") return;
    setSelected(answer);

    if (answer === current.correct) {
      setStatus("correct");
      schedule(() => {
        if (roundIndex >= rounds.length - 1) {
          setStatus("complete");
          setSelected(null);
          return;
        }

        const nextIndex = roundIndex + 1;
        setRoundIndex(nextIndex);
        setOptions(rotate(rounds[nextIndex].options, nextIndex + misses + 1));
        setSelected(null);
        setStatus("idle");
      }, 680);
      return;
    }

    const nextMisses = misses + 1;
    setMisses(nextMisses);
    setStatus("wrong");
    setMixTick((value) => value + 1);

    schedule(() => {
      setOptions((previous) => rotate(previous, 1 + (nextMisses % Math.max(previous.length - 1, 1))));
      setSelected(null);
      setStatus("idle");
    }, 560);
  };

  const restart = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setRoundIndex(0);
    setStatus("idle");
    setMisses(0);
    setMixTick(0);
    setSelected(null);
    setOptions(rotate(rounds[0].options, 1));
  };

  if (status === "complete") {
    return (
      <div className="landing-mini-game landing-mini-game-complete" data-game-status="complete">
        <div className="landing-mini-celebration" aria-hidden="true">
          <Sparkles className="h-7 w-7" />
        </div>
        <p className="landing-eyebrow">{isPortuguese ? "Mini partida concluída" : "Mini game complete"}</p>
        <h3>{isPortuguese ? "3 de 3. Você já jogou dentro da landing." : "3 of 3. You just played inside the landing page."}</h3>
        <p className="landing-mini-summary">
          {isPortuguese
            ? misses === 0
              ? "Perfeito — nenhuma tentativa errada."
              : `${misses} ${misses === 1 ? "erro" : "erros"} no caminho. O jogo misturou as opções e você continuou.`
            : misses === 0
              ? "Perfect — no misses."
              : `${misses} ${misses === 1 ? "miss" : "misses"}. The game reshuffled the options and kept going.`}
        </p>
        <div className="landing-mini-complete-actions">
          <Link to={continueHref} className="landing-primary landing-mini-continue">
            <Gamepad2 aria-hidden="true" className="h-4 w-4" />
            {isPortuguese ? "Continuar jogando" : "Keep playing"}
          </Link>
          <button type="button" className="landing-mini-reset" onClick={restart}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {isPortuguese ? "Jogar de novo" : "Play again"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-mini-game" data-game-status={status} data-mix-tick={mixTick}>
      <div className="landing-mini-hud">
        <span className="landing-mini-mode"><Gamepad2 aria-hidden="true" className="h-3.5 w-3.5" /> {isPortuguese ? "Modo gamificado" : "Gamified mode"}</span>
        <span>{isPortuguese ? `Rodada ${roundIndex + 1} de ${rounds.length}` : `Round ${roundIndex + 1} of ${rounds.length}`}</span>
      </div>

      <div className="landing-mini-progress" aria-label={isPortuguese ? "Progresso da mini partida" : "Mini game progress"}>
        {rounds.map((round, index) => (
          <span
            key={round.prompt}
            className={index < completedRounds ? "is-done" : index === roundIndex ? "is-current" : undefined}
          />
        ))}
      </div>

      <div className="landing-mini-question" key={roundIndex}>
        <p className="landing-eyebrow">{current.context}</p>
        <p className="landing-demo-prompt">{current.prompt}</p>
        <p className="landing-mini-instruction">{isPortuguese ? "Escolha a melhor resposta." : "Choose the best answer."}</p>
      </div>

      <div className={`landing-mini-options ${status === "wrong" ? "is-mixing" : ""}`} key={`${roundIndex}-${mixTick}`}>
        {options.map((option, index) => {
          const isSelected = selected === option;
          const isCorrect = status === "correct" && isSelected;
          const isWrong = status === "wrong" && isSelected;

          return (
            <button
              type="button"
              key={option}
              className={`landing-mini-option${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}`}
              onClick={() => handleAnswer(option)}
              disabled={status !== "idle"}
              style={{ "--mini-option-index": index } as React.CSSProperties}
            >
              <span>{option}</span>
              <span className="landing-mini-option-icon" aria-hidden="true">
                {isCorrect ? <Check className="h-4 w-4" /> : isWrong ? <X className="h-4 w-4" /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="landing-mini-feedback" aria-live="polite">
        {status === "correct" ? (
          <span className="is-correct"><Check aria-hidden="true" className="h-4 w-4" /> {isPortuguese ? "Boa! Próxima rodada…" : "Nice! Next round…"}</span>
        ) : status === "wrong" ? (
          <span className="is-wrong"><Shuffle aria-hidden="true" className="h-4 w-4" /> {isPortuguese ? "Quase. Misturando as opções…" : "Almost. Shuffling the options…"}</span>
        ) : (
          <span>{misses > 0 ? (isPortuguese ? `${misses} ${misses === 1 ? "tentativa errada" : "tentativas erradas"} até agora` : `${misses} misses so far`) : demo.instruction}</span>
        )}
      </div>
    </div>
  );
}
