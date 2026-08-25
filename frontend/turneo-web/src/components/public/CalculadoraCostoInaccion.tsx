"use client";

import { useState } from "react";
import { buildWhatsAppUrl } from "@/src/lib/contact";

const SEMANAS_POR_MES = 4.33;

const TRACK_COLOR = "#EFE1D9"; // porcelain
const FILL_COLOR = "#D69AA6"; // blush

const SLIDER_THUMB_CLASSES =
  "h-2 w-full cursor-pointer appearance-none rounded-full outline-none " +
  "focus-visible:ring-2 focus-visible:ring-blush/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ivory " +
  "[&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white " +
  "[&::-webkit-slider-thumb]:bg-blush [&::-webkit-slider-thumb]:shadow-soft [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:appearance-none " +
  "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white " +
  "[&::-moz-range-thumb]:bg-blush [&::-moz-range-thumb]:shadow-soft [&::-moz-range-thumb]:cursor-pointer " +
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
    <section className="mx-auto max-w-6xl space-y-10 px-6 py-20">
      <div className="space-y-3 text-center">
        <span className="badge mx-auto">El costo de no actuar</span>
        <h2 className="text-3xl font-semibold text-charcoal md:text-4xl">
          ¿Cuánto te está costando no tener un sistema de turnos?
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-charcoal/60">
          Movés los datos de tu negocio y ves al instante cuánta plata se te está yendo cada mes.
        </p>
      </div>

      <div className="glass-card grid gap-8 p-7 md:grid-cols-2 md:p-10">
        {/* INPUTS */}
        <div className="space-y-8">
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="calc-ausencias" className="font-medium text-charcoal/70">
                Ausencias (no-shows) por semana
              </label>
              <span className="font-semibold text-blushdark">{ausenciasPorSemana}</span>
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

          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="calc-ticket" className="font-medium text-charcoal/70">
                Ticket promedio por turno
              </label>
              <span className="font-semibold text-blushdark">{formatMoney(ticketPromedio)}</span>
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

          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="calc-horas" className="font-medium text-charcoal/70">
                Horas por semana armando turnos a mano
              </label>
              <span className="font-semibold text-blushdark">{horasManualesPorSemana} hs</span>
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
        <div className="flex flex-col justify-center space-y-6 border-t border-mauve/15 pt-7 text-center md:border-l md:border-t-0 md:pl-10 md:pt-0 md:text-left">
          <div aria-live="polite" aria-atomic="true" className="space-y-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-charcoal/70">Estás perdiendo aprox.</p>
              <p className="text-4xl font-bold text-charcoal md:text-5xl">
                {formatMoney(perdidaMensual)}
                <span className="text-base font-medium text-charcoal/70"> / mes</span>
              </p>
              <p className="text-sm text-charcoal/70">{formatMoney(perdidaAnual)} por año</p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-cream">
                <div className="h-full bg-blush" style={{ width: `${pctAusencias}%` }} />
                <div className="h-full bg-champagne" style={{ width: `${pctTiempo}%` }} />
              </div>
              <div className="flex justify-between text-xs text-charcoal/70">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blush" /> Ausencias ({formatMoney(perdidaAusenciasMensual)})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-champagne" /> Tiempo a mano ({formatMoney(perdidaTiempoMensual)})
                </span>
              </div>
            </div>
          </div>

          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-blush px-6 py-3 text-center text-sm font-semibold text-white shadow-glow transition [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02]"
          >
            Quiero dejar de perder esto
          </a>

          <p className="text-[11px] text-charcoal/70">
            Estimación con los datos que cargaste vos. Asumimos que cada hora perdida armando turnos a mano
            equivale, en promedio, a un cliente menos atendido o conseguido, valorizado a tu mismo ticket
            promedio. No es una cifra de Turneo ni una promesa de ahorro.
          </p>
        </div>
      </div>
    </section>
  );
}
