"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowCounterClockwise, ArrowUp, CircleNotch, Stop, X } from "@phosphor-icons/react";
import { LAYER_BY_ID } from "@/content/layers";
import type { LayerId, Plot } from "@/lib/contracts";
import { formatLocation, plotLocation } from "@/lib/routes";
import styles from "./AskPanel.module.css";

const SUGGESTIONS = [
  "Si può costruire una casa su questo terreno?",
  "Ci sono rischi di alluvione o di frana?",
  "Quali vincoli ambientali o paesaggistici ci sono?",
  "Com'è servita la zona?",
];

/** Messages sent back to the server: enough context for follow-ups, bounded in size and cost. */
const HISTORY = 8;

function textOnly(message: UIMessage): UIMessage {
  if (message.role === "user") return message;
  const parts = message.parts.filter((part) => part.type === "text");
  // Providers reject empty text blocks, so a tools-only answer keeps a short marker instead.
  return { ...message, parts: parts.length ? parts : [{ type: "text", text: "(dati consultati)" }] };
}

/** Tools the server exposes; their parts render as "consulted source" lines. */
const TOOL_LABEL: Record<string, string> = {
  getPlot: "Dati catastali del terreno",
  listLayers: "Elenco delle analisi disponibili",
};

type Props = { plot: Plot; onClose?: () => void };

export function AskPanel({ plot, onClose }: Props) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/v1/studio/chat",
        // The server re-reads layers through its tools, so earlier answers only need their text.
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: {
            id,
            plotId: plot.id,
            at: formatLocation(plotLocation(plot)),
            messages: messages.slice(-HISTORY).map(textOnly),
          },
        }),
      }),
    [plot],
  );

  const { messages, sendMessage, status, stop, error, regenerate, setMessages, clearError } = useChat({
    id: plot.id,
    transport,
  });
  const restart = () => {
    stop();
    clearError();
    setMessages([]);
  };
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    sendMessage({ text: clean });
    setInput("");
  };

  return (
    <section className={styles.panel} aria-label="Chiedi al terreno">
      <header className={styles.head}>
        <div>
          <h2>Chiedi al terreno</h2>
          <p>{plot.cadastral.label}</p>
        </div>
        <div className={styles.headActions}>
          {messages.length ? (
            <button type="button" className={styles.restart} onClick={restart} disabled={busy}>
              <ArrowCounterClockwise size={14} aria-hidden="true" /> Nuova
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Chiudi l'assistente">
              <X size={16} />
            </button>
          ) : null}
        </div>
      </header>

      <div ref={listRef} className={styles.messages} aria-live="polite">
        {messages.length === 0 ? (
          <div className={styles.intro}>
            <p>
              Le risposte usano solo i dati raccolti per questo terreno e indicano da quale fonte arriva ogni
              informazione.
            </p>
            <ul className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => send(s)}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}

        {status === "submitted" ? (
          <p className={styles.thinking}>
            <CircleNotch size={14} className={styles.spin} aria-hidden="true" /> Lettura dei dati del terreno…
          </p>
        ) : null}

        {error ? (
          <div className={styles.error} role="alert">
            <p>{errorText(error)}</p>
            {tooLong(error) ? (
              <button type="button" onClick={restart}>
                Nuova conversazione
              </button>
            ) : (
              <button type="button" onClick={() => regenerate()}>
                Riprova
              </button>
            )}
          </div>
        ) : null}
      </div>

      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label className="visually-hidden" htmlFor="ask-input">
          Domanda sul terreno
        </label>
        <textarea
          id="ask-input"
          rows={1}
          value={input}
          placeholder="Fai una domanda su questo terreno…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        {busy ? (
          <button
            type="button"
            className={styles.send}
            onClick={() => stop()}
            aria-label="Interrompi la risposta"
          >
            <Stop size={15} weight="fill" />
          </button>
        ) : (
          <button
            type="submit"
            className={styles.send}
            disabled={!input.trim()}
            aria-label="Invia la domanda"
          >
            <ArrowUp size={16} weight="bold" />
          </button>
        )}
      </form>
      <p className={styles.footnote}>
        Le risposte possono contenere errori. Verifica sempre le fonti citate.
      </p>
    </section>
  );
}

function Message({ message }: { message: UIMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return <p className={styles.user}>{text}</p>;
  }

  return (
    <div className={styles.assistant}>
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return (
            <div key={index} className={styles.prose}>
              <ReactMarkdown>{part.text}</ReactMarkdown>
            </div>
          );
        }
        if (part.type.startsWith("tool-") && "state" in part) {
          return <ToolLine key={index} name={part.type.slice(5)} part={part} />;
        }
        return null;
      })}
    </div>
  );
}

function ToolLine({ name, part }: { name: string; part: { state?: string; input?: unknown } }) {
  const layer = (part.input as { layer?: LayerId } | undefined)?.layer;
  const label = layer && LAYER_BY_ID[layer] ? LAYER_BY_ID[layer].title : (TOOL_LABEL[name] ?? name);
  const done = part.state === "output-available";
  const failed = part.state === "output-error";
  return (
    <p className={styles.tool} data-state={done ? "done" : failed ? "failed" : "running"}>
      {done ? "Consultato" : failed ? "Non disponibile" : "Consulto"} · {label}
    </p>
  );
}

const tooLong = (error: Error) => /troppo lunga|413/.test(error.message);

function errorText(error: Error) {
  if (tooLong(error)) {
    return "La conversazione è diventata troppo lunga. Ricomincia: i dati del terreno restano gli stessi.";
  }
  if (/not_configured|503/.test(error.message)) {
    return "L'assistente non è ancora configurato su questo ambiente.";
  }
  if (/rate_limited|429/.test(error.message)) {
    return "Troppe domande in poco tempo. Aspetta qualche secondo e riprova.";
  }
  return "La risposta si è interrotta. Puoi riprovare.";
}
