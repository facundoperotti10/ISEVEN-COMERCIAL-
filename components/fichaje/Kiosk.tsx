'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { ClockKind, StaffArea } from '@/lib/database.types';
import {
  AREA_COLOR,
  COMIDA_MIN,
  KIND_LABEL,
  KIOSK_TOKEN_KEY,
  TZ,
  errorMessage,
  horaAR,
  minutosATexto,
  nextKinds,
  cap,
} from '@/lib/oficina';

interface BoardRow {
  id: string;
  name: string;
  area: StaffArea;
  pin_set: boolean;
  start_time: string;
  last_kind: ClockKind | null;
  last_at: string | null;
  lunch_at: string | null;
}

interface PunchResult {
  name: string;
  kind: ClockKind;
  at: string;
  late_minutes: number;
  worked_minutes: number | null;
  start_time: string;
}

type View =
  | { step: 'board' }
  | { step: 'pin'; person: BoardRow; kind: ClockKind | null }
  | { step: 'result'; result: PunchResult; photo: boolean };

function readToken(): string | null {
  try {
    return window.localStorage.getItem(KIOSK_TOKEN_KEY);
  } catch {
    return null;
  }
}

function subscribeNoop() {
  return () => {};
}

function readTokenServer(): string | null | undefined {
  return undefined;
}

function statusOf(p: BoardRow, now: number): { label: string; tone: 'ok' | 'lunch' | 'late' | 'out' | 'none' } {
  if (!p.last_kind) return { label: 'Sin marcar', tone: 'none' };
  if (p.last_kind === 'salida') return { label: `Salió ${horaAR(p.last_at!)}`, tone: 'out' };
  if (p.last_kind === 'salida_comida' && p.lunch_at) {
    const left = COMIDA_MIN - (now - new Date(p.lunch_at).getTime()) / 60000;
    return left >= 0
      ? { label: `Comiendo · quedan ${Math.ceil(left)} min`, tone: 'lunch' }
      : { label: `Comiendo · pasado ${Math.ceil(-left)} min`, tone: 'late' };
  }
  return { label: 'En la oficina', tone: 'ok' };
}

const TONE_CLASS = {
  ok: 'bg-green/15 text-green',
  lunch: 'bg-yellow/15 text-yellow',
  late: 'bg-red/20 text-red',
  out: 'bg-lilac/15 text-lilac',
  none: 'bg-bg text-text-muted',
} as const;

export function Kiosk() {
  const supabase = useMemo(() => createClient(), []);
  const token = useSyncExternalStore(subscribeNoop, readToken, readTokenServer);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ step: 'board' });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadBoard = useCallback(async () => {
    if (!token) return;
    const { data, error } = await supabase.rpc('kiosk_board', { p_token: token });
    if (error) {
      setBoardError(/DEVICE/.test(error.message) ? 'DEVICE' : errorMessage(error));
      return;
    }
    setBoardError(null);
    setBoard((data as BoardRow[]) ?? []);
  }, [supabase, token]);

  useEffect(() => {
    if (!token) return;
    const first = setTimeout(loadBoard, 0);
    const t = setInterval(loadBoard, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [token, loadBoard]);

  // Mantiene la pantalla prendida mientras está abierta (si el teléfono lo permite).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  if (token === undefined) return <main className="min-h-screen bg-bg" />;

  if (!token || boardError === 'DEVICE') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
        <h1 className="font-display text-2xl font-extrabold">Ingreso y egreso</h1>
        <p className="mt-3 max-w-sm text-sm text-text-secondary">
          Este dispositivo no está habilitado para fichar. Se ficha solo desde el iPhone de la oficina.
        </p>
        <p className="mt-3 max-w-sm text-xs text-text-muted">
          Para habilitarlo: entrá al Panel de control desde este teléfono, andá a Asistencia y tocá “Activar este
          dispositivo como reloj”.
        </p>
        <Link href="/login" className="mt-6 text-sm text-text-secondary underline underline-offset-4">
          Volver al inicio
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-bg px-4 py-6">
      {view.step === 'board' && (
        <BoardView
          board={board}
          now={now}
          error={boardError}
          onPick={(person) => {
            const kinds = nextKinds(person.last_kind);
            if (!person.pin_set) {
              setBoardError(`${person.name} todavía no tiene PIN. Pedíselo a Facu o Mike.`);
              return;
            }
            if (kinds.length === 0) {
              setBoardError(`${person.name} ya marcó la salida de hoy.`);
              return;
            }
            setBoardError(null);
            setView({ step: 'pin', person, kind: kinds.length === 1 ? kinds[0] : null });
          }}
        />
      )}
      {view.step === 'pin' && (
        <PinView
          person={view.person}
          kind={view.kind}
          onKind={(kind) => setView({ ...view, kind })}
          onBack={() => setView({ step: 'board' })}
          onDone={(result, photo) => {
            setView({ step: 'result', result, photo });
            loadBoard();
          }}
          token={token}
        />
      )}
      {view.step === 'result' && <ResultView result={view.result} photo={view.photo} onClose={() => setView({ step: 'board' })} />}
    </main>
  );
}

function BoardView({
  board,
  now,
  error,
  onPick,
}: {
  board: BoardRow[];
  now: number;
  error: string | null;
  onPick: (p: BoardRow) => void;
}) {
  const date = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  return (
    <>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-text-muted">Ingreso y egreso</p>
        <p className="stat-number mt-1 text-6xl">{horaAR(new Date(now))}</p>
        <p className="mt-1 text-sm text-text-secondary">{cap(date)}</p>
      </div>
      <p className="mb-3 mt-6 text-center text-sm text-text-secondary">Tocá tu nombre</p>
      {error && <p className="mb-3 rounded-[10px] bg-red/15 px-3 py-2 text-center text-sm text-red">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        {board.map((p) => {
          const st = statusOf(p, now);
          return (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="card flex flex-col items-start gap-2 p-3 text-left transition active:scale-[0.98]"
            >
              <span className="flex items-center gap-2">
                <span
                  className="grid h-8 w-8 place-items-center rounded-full font-display text-sm font-extrabold text-bg"
                  style={{ background: AREA_COLOR[p.area] }}
                >
                  {p.name[0]}
                </span>
                <span className="font-semibold text-text">{p.name}</span>
              </span>
              <span className={`badge ${TONE_CLASS[st.tone]}`}>{st.label}</span>
            </button>
          );
        })}
      </div>
      <Link href="/login" className="mt-auto pt-8 text-center text-xs text-text-muted">
        Volver al inicio
      </Link>
    </>
  );
}

function PinView({
  person,
  kind,
  token,
  onKind,
  onBack,
  onDone,
}: {
  person: BoardRow;
  kind: ClockKind | null;
  token: string;
  onKind: (k: ClockKind) => void;
  onBack: () => void;
  onDone: (r: PunchResult, photo: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOk, setCamOk] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCamOk(true);
      })
      .catch(() => setCamOk(false));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function capture(): Promise<Blob | null> {
    const v = videoRef.current;
    if (!v || !camOk || !v.videoWidth) return null;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, 360, 360);
    return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.8));
  }

  async function submit(fullPin: string) {
    if (!kind) return;
    setBusy(true);
    setError(null);
    let photoPath = '';
    try {
      const blob = await capture();
      if (blob) {
        const month = new Date().toISOString().slice(0, 7);
        const path = `${month}/${person.id}-${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from('fichajes').upload(path, blob, { contentType: 'image/jpeg' });
        if (!upErr) photoPath = path;
      }
    } catch {
      // Si la foto falla, el fichaje igual se registra (queda "sin foto").
    }
    const { data, error: rpcErr } = await supabase.rpc('kiosk_punch', {
      p_token: token,
      p_staff: person.id,
      p_pin: fullPin,
      p_kind: kind,
      p_photo: photoPath,
    });
    setBusy(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      setPin('');
      return;
    }
    onDone(data as PunchResult, Boolean(photoPath));
  }

  function press(k: string) {
    if (busy) return;
    if (k === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) submit(next);
  }

  const options = nextKinds(person.last_kind);

  return (
    <div className="flex flex-1 flex-col">
      <button onClick={onBack} className="self-start text-sm text-text-muted">
        ← volver
      </button>
      <div className="mt-2 flex flex-col items-center">
        <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-border bg-card">
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full scale-x-[-1] object-cover" />
          {camOk === false && (
            <span className="absolute inset-0 grid place-items-center px-3 text-center text-[11px] text-text-muted">
              Sin cámara: se ficha sin foto
            </span>
          )}
        </div>
        <p className="mt-3 font-display text-2xl font-extrabold">{person.name}</p>
      </div>

      {!kind ? (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-center text-sm text-text-secondary">¿Qué querés marcar?</p>
          {options.map((k) => (
            <button
              key={k}
              onClick={() => onKind(k)}
              className="rounded-[14px] border border-border bg-bg-elevated px-4 py-4 text-lg font-semibold"
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="mt-4 text-center text-sm text-text-secondary">
            {KIND_LABEL[kind]} · ingresá tu PIN
          </p>
          <div className="my-4 flex justify-center gap-4" aria-label={`${pin.length} de 4 números`}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-4 w-4 rounded-full border-2 ${i < pin.length ? 'border-text bg-text' : 'border-border'}`}
              />
            ))}
          </div>
          {error && <p className="mb-2 text-center text-sm text-red">{error}</p>}
          {busy && <p className="mb-2 text-center text-sm text-text-secondary">Registrando…</p>}
          <div className="mt-auto grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k) =>
              k === '' ? (
                <span key="sp" />
              ) : (
                <button
                  key={k}
                  onClick={() => press(k)}
                  aria-label={k === 'del' ? 'Borrar' : k}
                  className="rounded-[14px] bg-bg-elevated py-4 font-display text-2xl font-bold active:bg-primary"
                >
                  {k === 'del' ? '⌫' : k}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ResultView({ result, photo, onClose }: { result: PunchResult; photo: boolean; onClose: () => void }) {
  const checksLate = result.kind === 'entrada' || result.kind === 'vuelta_comida';
  const late = checksLate && result.late_minutes > 0;
  const tone = !checksLate ? 'neutral' : late ? 'late' : 'ok';

  useEffect(() => {
    if (late) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {}
    }
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [late, onClose]);

  const vuelta = result.kind === 'salida_comida' ? horaAR(new Date(new Date(result.at).getTime() + COMIDA_MIN * 60000)) : null;

  const title =
    result.kind === 'salida_comida'
      ? '¡Buen provecho!'
      : result.kind === 'salida'
        ? '¡Hasta mañana!'
        : late
          ? result.kind === 'entrada'
            ? 'Llegaste tarde'
            : 'Volviste tarde'
          : '¡A tiempo!';

  const note =
    result.kind === 'salida_comida'
      ? `Tenés 1 hora. Volvé antes de las ${vuelta}`
      : result.kind === 'salida'
        ? result.worked_minutes != null
          ? `Hoy trabajaste ${minutosATexto(result.worked_minutes)}`
          : 'Salida registrada'
        : late
          ? `${result.late_minutes} min tarde · tolerancia 5 min`
          : result.kind === 'entrada'
            ? `Entrada ${result.start_time} · tolerancia 5 min`
            : 'Volviste dentro de la hora';

  return (
    <button
      onClick={onClose}
      className={`kiosk-result kiosk-${tone} fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 px-6 text-center text-white`}
    >
      {tone !== 'neutral' && (
        <>
          <span className="kiosk-ring" />
          <span className="kiosk-ring kiosk-r2" />
          <span className="kiosk-ring kiosk-r3" />
        </>
      )}
      <span className="kiosk-badge">
        <svg viewBox="0 0 48 48" className="h-16 w-16" aria-hidden="true">
          {late ? (
            <>
              <path d="M24 12v15" />
              <path d="M24 35v.5" />
            </>
          ) : (
            <path d="M12 25l8 8 16-17" />
          )}
        </svg>
      </span>
      <span className="relative z-10 mt-2 font-display text-3xl font-extrabold">{title}</span>
      <span className="relative z-10 text-base opacity-90">
        {result.name} · {KIND_LABEL[result.kind]}
      </span>
      <span className="stat-number relative z-10 text-5xl">{horaAR(result.at)}</span>
      <span className="relative z-10 rounded-full bg-black/20 px-4 py-2 text-sm">{note}</span>
      {!photo && <span className="relative z-10 text-xs opacity-75">Sin foto</span>}
    </button>
  );
}
