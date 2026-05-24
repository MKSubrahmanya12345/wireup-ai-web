import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  FormEvent,
} from "react";

// ─── Types ─────────────────────────────────────────────────────

type Ripple = {
  id: number;
  x: number;
  y: number;
};

type Tone = "shader" | "light" | "dark";

interface PromptInputProps {
  placeholder?: string;
  onSubmit?: (value: string) => void;
  disabled?: boolean;
  glowIntensity?: number;
  expandOnFocus?: boolean;
  animationDuration?: number;
  backgroundOpacity?: number;
  showEffects?: boolean;
  maxRows?: number;
  helperText?: string;
  submitLabel?: string;
  tone?: Tone;
}

const defaultMenuOptions: never[] = [];

// ─── Utils ─────────────────────────────────────────────────────
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// ─── Glow Effects ───────────────────────────────────────────────
function GlowEffects({
  glowIntensity,
  mousePosition,
  animationDuration,
  enabled,
}: {
  glowIntensity: number;
  mousePosition: { x: number; y: number };
  animationDuration: number;
  enabled: boolean;
}) {
  if (!enabled) return null;

  return (
    <>
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-white/8 via-white/12 to-white/8 backdrop-blur-2xl" />

      <div
        className="absolute inset-0 rounded-3xl opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        style={{
          transitionDuration: `${animationDuration}ms`,
          boxShadow: `
            0 0 0 1px rgba(147, 51, 234, ${0.2 * glowIntensity}),
            0 0 8px rgba(147, 51, 234, ${0.3 * glowIntensity}),
            0 0 16px rgba(236, 72, 153, ${0.2 * glowIntensity}),
            0 0 24px rgba(59, 130, 246, ${0.15 * glowIntensity})
          `,
          filter: "blur(0.5px)",
        }}
      />

      <div
        className="absolute inset-0 rounded-3xl opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          transitionDuration: `${animationDuration}ms`,
          boxShadow: `
            0 0 12px rgba(147, 51, 234, ${0.4 * glowIntensity}),
            0 0 20px rgba(236, 72, 153, ${0.25 * glowIntensity}),
            0 0 32px rgba(59, 130, 246, ${0.2 * glowIntensity})
          `,
          filter: "blur(1px)",
        }}
      />

      <div
        className="absolute inset-0 rounded-3xl opacity-0 transition-opacity group-hover:opacity-20"
        style={{
          background: `radial-gradient(circle 120px at ${mousePosition.x}% ${mousePosition.y}%, rgba(147,51,234,0.08) 0%, rgba(236,72,153,0.05) 30%, rgba(59,130,246,0.04) 60%, transparent 100%)`,
        }}
      />
    </>
  );
}

// ─── Ripple Effects ─────────────────────────────────────────────
function RippleEffects({
  ripples,
  enabled,
}: {
  ripples: Ripple[];
  enabled: boolean;
}) {
  if (!enabled || ripples.length === 0) return null;

  return (
    <>
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute pointer-events-none blur-sm"
          style={{
            left: ripple.x - 25,
            top: ripple.y - 25,
            width: 50,
            height: 50,
          }}
        >
          <div className="h-full w-full rounded-full bg-gradient-to-r from-purple-400/15 via-pink-400/10 to-blue-400/15 animate-ping" />
        </div>
      ))}
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function PromptInputDynamicGrow({
  placeholder = "What do you want to build?",
  onSubmit,
  disabled = false,
  glowIntensity = 0.4,
  expandOnFocus = true,
  animationDuration = 500,
  backgroundOpacity = 0.12,
  showEffects = true,
  maxRows = 4,
  helperText = "Press Enter to start",
  submitLabel = "Get started",
  tone = "shader",
}: PromptInputProps) {
  const [value, setValue] = useState<string>("");
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const throttleRef = useRef<number | null>(null);

  const isSubmitDisabled = disabled || !value.trim();
  const isShaderTone = tone === "shader";

  const addRipple = useCallback(
    (x: number, y: number) => {
      if (!showEffects || ripples.length >= 5) return;

      const newRipple: Ripple = { x, y, id: Date.now() };

      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);
    },
    [ripples.length, showEffects]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!showEffects) return;

      if (containerRef.current && !throttleRef.current) {
        throttleRef.current = window.setTimeout(() => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const x = ((event.clientX - rect.left) / rect.width) * 100;
            const y = ((event.clientY - rect.top) / rect.height) * 100;
            setMousePosition({ x, y });
          }
          throttleRef.current = null;
        }, 50);
      }
    },
    [showEffects]
  );

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    addRipple(event.clientX - rect.left, event.clientY - rect.top);
  }, [addRipple]);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!value.trim() || !onSubmit || disabled) return;

      onSubmit(value.trim());
      setValue("");
    },
    [value, onSubmit, disabled]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSubmit(event as unknown as FormEvent);
      }
    },
    [handleSubmit]
  );

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "auto";

    const scrollHeight = textareaRef.current.scrollHeight;
    const lineHeight = 22;
    const maxHeight = lineHeight * maxRows + 16;

    textareaRef.current.style.height = `${clamp(
      scrollHeight,
      lineHeight,
      maxHeight
    )}px`;
  }, [value, maxRows]);

  const containerStyle = useMemo(
    () => ({
      backgroundColor: isShaderTone
        ? "rgba(24, 20, 42, 0.72)"
        : `rgba(255, 255, 255, ${backgroundOpacity})`,
      border: isShaderTone
        ? "1px solid rgba(131, 96, 255, 0.35)"
        : "1px solid rgba(255, 255, 255, 0.12)",
      transition: `all ${animationDuration}ms ease`,
    }),
    [isShaderTone, backgroundOpacity, animationDuration]
  );

  return (
    <form onSubmit={handleSubmit} className="relative mx-auto w-full">
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        className="group relative flex w-full flex-col rounded-3xl p-4"
        style={containerStyle}
      >
        <GlowEffects
          glowIntensity={glowIntensity}
          mousePosition={mousePosition}
          animationDuration={animationDuration}
          enabled={showEffects}
        />

        <RippleEffects ripples={ripples} enabled={showEffects} />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full resize-none bg-transparent outline-none"
        />

        <button type="submit" disabled={isSubmitDisabled}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export { defaultMenuOptions };