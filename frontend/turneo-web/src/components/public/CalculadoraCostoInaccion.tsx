"use client";

import { useState } from "react";
import { buildWhatsAppUrl } from "@/src/lib/contact";
import Reveal from "@/src/components/public/Reveal";

const SEMANAS_POR_MES = 4.33;

const TRACK_COLOR = "#EFE1D9"; // porcelain
const FILL_COLOR = "#8F4C5D"; // rosewood

const SLIDER_THUMB_CLASSES =
  "h-2 w-full cursor-pointer appearance-none rounded-full outline-none " +
  "focus-visible:ring-2 focus-visible:ring-rosewood/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory " +
  "[&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white " +
  "[&::-webkit-slider-thumb]:bg-rosewood [&::-webkit-slider-thumb]:shadow-soft [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:appearance-none " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white " +
  "[&::-moz-range-thumb]:bg-rosewood [&::-moz-range-thumb]:shadow-soft [&::-moz-range-thumb]:cursor-pointer " +
  "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent";

function formatMoney(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function trackBackground(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  return `linear-gradient(to right, ${FILL_COLOR} ${pct}%, ${TRACK_COLOR} ${pct}%)`;
}

// Calculadora del costo de la no-acción de la home comercial ("/"): resultado
// inmediato sin pedir datos de contacto (a propósito: el foco es el número, no
// el gate). Los únicos números que muestra salen de lo que carga el visitante.
export default function CalculadoraCostoInaccion() {
  const [ausenciasPorSemana, setAusenciasPorSemana] = useState(3);
  const [ticketPromedio, setTicketPromedio] = useState(8000);
  const [horasManualesPorSemana, setHorasManualesPorSemana] = useState(5);

  const perdidaAusenciasMensual = ausenciasPorSemana * ticketPromedio * SEMANAS_POR_MES;
  const perdidaTiempoMensual = horasManualesPorSemana * ticketPromedio * SEMANAS_POR_MES;
  const perdidaMensual = perdidaAusenciasMensual + perdidaTiempoMensual;
  const perdidaAnual = perdidaMensual * 12;

  const pctAusencias = perdidaMensual > 0 ? (perdidaAusenciasMensual / perdidaMensual) * 100 : 50;
  const pctTiempo = 100 - pctAusencias;

  const whatsAppUrl = buildWhatsAppUrl(
    `Hola! Calculé que estoy perdiendo aprox ${formatMoney(perdidaMensual)} por mes por no tener un sistema de turnos. Quiero saber más de Turneo.`
  );

  return (
    <section id="calculadora" className="scroll-mt-16 mx-auto max-w-6xl space-y-10 px-6 py-20 md:space-y-12 md:py-28">
      <Reveal className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-16">
        <div className="space-y-3 md:flex-[1.4]">
          <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-rosewood">El costo de no actuar</span>
          <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-charcoal md:text-[3.25rem]">
            ¿Cuánto te cuesta <span className="accent-serif text-rosewood">seguir así?</span>
          </h2>
        </div>
        <p className="max-w-md text-[17px] leading-relaxed text-charcoal/70 md:flex-1">
          Movés los datos de tu salón y ves al instante cuánta plata se te está yendo cada mes.
        </p>
      </Reveal>

      <Reveal className="grid overflow-hidden rounded-[1.75rem] bg-ivory shadow-soft md:grid-cols-2">
        {/* INPUTS */}
        <div className="flex flex-col justify-center gap-9 p-6 sm:p-8 md:p-10">
          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor="calc-ausencias" className="text-[15px] font-medium text-charcoal">
                Ausencias por semana
              </label>
              <span className="shrink-0 text-xl font-semibold text-rosewood">{ausenciasPorSemana}</span>
            </div>
            <input
              id="calc-ausencias"
              type="range"
              min={0}
              max={20}
              step={1}
              value={ausenciasPorSemana}
              onChange={(e) => setAusenciasPorSemana(Number(e.target.value))}
              aria-valuetext={`${ausenciasPorSemana} ausencias por semana`}
              style={{ background: trackBackground(ausenciasPorSemana, 0, 20) }}
              className={SLIDER_THUMB_CLASSES}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor="calc-ticket" className="text-[15px] font-medium text-charcoal">
                Ticket promedio por turno
              </label>
              <span className="shrink-0 text-xl font-semibold text-rosewood">{formatMoney(ticketPromedio)}</span>
            </div>
            <input
              id="calc-ticket"
              type="range"
              min={1000}
              max={50000}
              step={500}
              value={ticketPromedio}
              onChange={(e) => setTicketPromedio(Number(e.target.value))}
              aria-valuetext={`${formatMoney(ticketPromedio)} por turno`}
              style={{ background: trackBackground(ticketPromedio, 1000, 50000) }}
              className={SLIDER_THUMB_CLASSES}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline justify-between gap-4">
              <label htmlFor="calc-horas" className="text-[15px] font-medium text-charcoal">
                Horas por semana armando turnos a mano
              </label>
              <span className="shrink-0 text-xl font-semibold text-rosewood">{horasManualesPorSemana} hs</span>
            </div>
            <input
              id="calc-horas"
              type="range"
              min={0}
              max={20}
              step={1}
              value={horasManualesPorSemana}
              onChange={(e) => setHorasManualesPorSemana(Number(e.target.value))}
              aria-valuetext={`${horasManualesPorSemana} horas por semana`}
              style={{ background: trackBackground(horasManualesPorSemana, 0, 20) }}
              className={SLIDER_THUMB_CLASSES}
            />
          </div>
        </div>

        {/* RESULTADO */}
        <div className="flex flex-col justify-center gap-7 bg-ink p-6 text-cream sm:p-8 md:p-10">
          <div aria-live="polite" aria-atomic="true" className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blush">Estás perdiendo aprox.</p>
              <p className="mt-2 text-[2.6rem] font-semibold leading-none tracking-tight sm:text-6xl">
                {formatMoney(perdidaMensual)}
                <span className="text-base font-medium tracking-normal text-mist"> / mes</span>
              </p>
              <p className="mt-2 text-sm text-mist">{formatMoney(perdidaAnual)} por año</p>
            </div>

            <div className="space-y-3">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-cream/10">
                <div className="h-full bg-blush" style={{ width: `${pctAusencias}%` }} />
                <div className="h-full bg-champagne" style={{ width: `${pctTiempo}%` }} />
              </div>
              <div className="flex flex-col gap-1.5 text-sm text-mist sm:flex-row sm:flex-wrap sm:justify-between sm:gap-x-4">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blush" /> Ausencias ({formatMoney(perdidaAusenciasMensual)})
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-champagne" /> Tiempo a mano ({formatMoney(perdidaTiempoMensual)})
                </span>
              </div>
            </div>
          </div>

          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-[52px] items-center justify-center gap-2.5 rounded-full border border-cream/30 px-7 text-center text-[15px] font-semibold text-cream transition hover:-translate-y-0.5 hover:border-cream/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blush sm:self-start"
          >
            Quiero dejar de perder esto
            <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>

          <p className="border-t border-cream/15 pt-5 text-xs leading-relaxed text-mist">
            Estimación con los datos que cargaste vos. Asumimos que cada hora perdida armando turnos a mano
            equivale, en promedio, a un cliente menos atendido o conseguido, valorizado a tu mismo ticket
            promedio. No es una cifra de Turneo ni una promesa de ahorro.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
