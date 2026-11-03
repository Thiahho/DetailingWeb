"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link2, MapPin, MessageCircle } from "lucide-react";
import {
  alturaEscrita,
  fetchDirecciones,
  fetchLocalidades,
  fetchUbicacion,
  type Coords,
  type DireccionSuggestion,
  type GeoError,
} from "@/src/lib/geo/geo";
import { formatSurcharge } from "@/src/lib/homeService/coverageLocality";
import {
  DETAILS_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  STREET_MAX_LENGTH,
  addressFromResolvedPlace,
  coverageWhatsAppMessage,
  type ActiveCoverageLocality,
  type HomeAddressForm,
} from "@/src/lib/homeService/bookingAddress";
import { getWhatsAppLink } from "@/src/lib/siteConfig";
import type { CoverageStatus } from "./useBookingFlow";
import { ADDRESS_THEMES, type AddressTone } from "./wizardStyles";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;
const OUTSIDE = "outside";

const MAPS_ERRORS: Record<GeoError, string> = {
  "link-invalido": "Ese link no parece ser de Google Maps. Copiá el link desde \"Compartir\" en la app.",
  "sin-coordenadas": "No pudimos leer la ubicación de ese link. Probá escribiendo la dirección.",
  "sin-servicio": "No pudimos consultar la ubicación ahora. Probá escribiendo la dirección.",
  "demasiadas-solicitudes": "Hiciste muchas consultas seguidas. Esperá un minuto e intentá de nuevo.",
};

interface Props {
  serviceTitle: string;
  homeAddress: HomeAddressForm;
  setHomeAddress: Dispatch<SetStateAction<HomeAddressForm>>;
  coverageLocalities: ActiveCoverageLocality[];
  coverageStatus: CoverageStatus;
  retryCoverage: () => void;
  whatsAppNumber?: string;
  // "dark": /reservar wizard (default); "light": Smart Tag form.
  tone?: AddressTone;
}

// Address of an at-home service. Coverage is decided only against the
// tenant's active localities; the geo lookups just help fill the street.
export default function HomeAddressStep({
  serviceTitle,
  homeAddress,
  setHomeAddress,
  coverageLocalities,
  coverageStatus,
  retryCoverage,
  whatsAppNumber,
  tone = "dark",
}: Props) {
  const t = ADDRESS_THEMES[tone];
  // Name of a locality outside the list (picked "not listed" or resolved from a Maps link).
  const [outside, setOutside] = useState<{ name: string } | null>(null);
  const [mapsUrl, setMapsUrl] = useState("");
  const [mapsState, setMapsState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [suggestions, setSuggestions] = useState<DireccionSuggestion[]>([]);
  const [streetQuery, setStreetQuery] = useState("");
  const [streetFocused, setStreetFocused] = useState(false);
  const [near, setNear] = useState<Coords | null>(null);

  const sorted = [...coverageLocalities].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const selected = coverageLocalities.find((l) => l.id === homeAddress.coverageLocalityId) ?? null;
  const noCoverage = coverageStatus === "ready" && coverageLocalities.length === 0;
  const update = (patch: Partial<HomeAddressForm>) => setHomeAddress((prev) => ({ ...prev, ...patch }));

  // Bias the street search around the chosen locality (Georef centroid).
  useEffect(() => {
    setNear(null);
    if (!selected) return;
    const controller = new AbortController();
    fetchLocalidades(selected.name, controller.signal)
      .then((found) => {
        const match =
          found.find((l) => l.provincia.toLowerCase() === selected.province.toLowerCase()) ?? found[0] ?? null;
        if (match) setNear({ lat: match.lat, lng: match.lng });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selected?.id]);

  // Street autocomplete: debounced, each keystroke aborts the previous request.
  useEffect(() => {
    const q = streetQuery.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchDirecciones(q, near, controller.signal)
        .then((found) => setSuggestions(Array.isArray(found) ? found : []))
        .catch(() => {
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [streetQuery, near]);

  const pickSuggestion = (s: DireccionSuggestion) => {
    const altura = s.altura ?? alturaEscrita(streetQuery, s.calle);
    update({ street: [s.calle, altura].filter(Boolean).join(" ") });
    setStreetQuery("");
    setSuggestions([]);
  };

  const applyMapsLink = async () => {
    const url = mapsUrl.trim();
    if (!url) return;
    setMapsState({ loading: true, error: null });
    const result = await fetchUbicacion(url);
    if ("error" in result) {
      setMapsState({ loading: false, error: result.message || MAPS_ERRORS[result.error] || MAPS_ERRORS["sin-servicio"] });
      return;
    }
    const { lugar } = result;
    setMapsState({ loading: false, error: null });
    // Functional update: a street typed while the lookup ran is not lost.
    setHomeAddress((prev) => addressFromResolvedPlace(prev, lugar, coverageLocalities).address);
    const { outsideName } = addressFromResolvedPlace(homeAddress, lugar, coverageLocalities);
    setOutside(outsideName === null ? null : { name: outsideName });
  };

  if (coverageStatus === "idle" || coverageStatus === "loading") {
    return <p className={`text-sm ${t.muted}`}>Cargando las zonas donde trabajamos...</p>;
  }

  if (coverageStatus === "error") {
    return (
      <div className={`space-y-3 text-sm ${t.muted}`} data-testid="home-address-coverage-error">
        <p>No pudimos cargar las zonas de cobertura.</p>
        <button
          type="button"
          onClick={retryCoverage}
          className={`min-h-[44px] px-5 font-semibold transition ${t.secondaryButton}`}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const outOfCoverage = noCoverage || outside !== null;
  const waMessage = coverageWhatsAppMessage({
    serviceTitle,
    street: homeAddress.street,
    locality: outside?.name ?? "",
  });

  return (
    <div className="space-y-5" data-testid="home-address-step">
      {!noCoverage && (
        <label className={t.label}>
          Localidad
          <select
            className={t.field}
            data-testid="home-address-locality"
            value={outside && !selected ? OUTSIDE : (homeAddress.coverageLocalityId ?? "")}
            onChange={(e) => {
              if (e.target.value === OUTSIDE) {
                update({ coverageLocalityId: null });
                setOutside({ name: "" });
                return;
              }
              update({ coverageLocalityId: e.target.value ? Number(e.target.value) : null });
              setOutside(null);
            }}
          >
            <option value="">Elegí tu localidad</option>
            {sorted.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.province ? ` (${l.province})` : ""}
                {l.surcharge ? ` · recargo $${formatSurcharge(l.surcharge)}` : ""}
              </option>
            ))}
            <option value={OUTSIDE}>Mi localidad no está en la lista</option>
          </select>
        </label>
      )}

      {outOfCoverage ? (
        <div
          data-testid="home-address-out-of-coverage"
          className={`space-y-3 text-sm leading-relaxed ${t.notice}`}
        >
          <p>
            {noCoverage
              ? "Por ahora no hay zonas habilitadas para el servicio a domicilio."
              : outside?.name
                ? `${outside.name} está fuera de nuestra zona de cobertura.`
                : "Si tu localidad no figura, todavía no llegamos a tu zona."}{" "}
            Escribinos y vemos si podemos coordinarlo.
          </p>
          {whatsAppNumber ? (
            <a
              href={getWhatsAppLink(whatsAppNumber, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="home-address-whatsapp"
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 font-semibold transition hover:-translate-y-0.5 ${t.primaryButton}`}
            >
              <MessageCircle className="size-4" />
              Consultar por WhatsApp
            </a>
          ) : (
            <p className={t.muted}>Contactá al negocio por sus redes para consultarlo.</p>
          )}
        </div>
      ) : null}

      {!noCoverage && (
        <>
          <div className={t.panel}>
            <label className={t.label} htmlFor="home-address-maps">
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="size-4" /> ¿Tenés la ubicación en Google Maps? Pegá el link
              </span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="home-address-maps"
                className={t.field}
                data-testid="home-address-maps-url"
                inputMode="url"
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.app.goo.gl/..."
              />
              <button
                type="button"
                data-testid="home-address-maps-apply"
                onClick={applyMapsLink}
                disabled={!mapsUrl.trim() || mapsState.loading}
                className={`min-h-[50px] shrink-0 px-5 text-sm font-semibold transition disabled:opacity-40 sm:mt-2 ${t.secondaryButton}`}
              >
                {mapsState.loading ? "Buscando..." : "Usar ubicación"}
              </button>
            </div>
            {mapsState.error && (
              <p role="alert" className={`mt-2 text-xs ${t.alert}`}>
                {mapsState.error}
              </p>
            )}
          </div>

          {!outside && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative sm:col-span-2">
                <label className={t.label} htmlFor="home-address-street">
                  Calle y número
                </label>
                <MapPin className={`pointer-events-none absolute left-4 top-[3.05rem] size-4 ${t.icon}`} />
                <input
                  id="home-address-street"
                  className={`${t.field} !pl-11`}
                  data-testid="home-address-street"
                  autoComplete="off"
                  maxLength={STREET_MAX_LENGTH}
                  value={homeAddress.street}
                  onChange={(e) => {
                    update({ street: e.target.value });
                    setStreetQuery(e.target.value);
                  }}
                  onFocus={() => setStreetFocused(true)}
                  onBlur={() => setStreetFocused(false)}
                  placeholder="Ej. Av. Mitre 1234"
                />
                {streetFocused && suggestions.length > 0 && (
                  <ul
                    role="listbox"
                    className={`absolute z-20 mt-1 max-h-64 w-full overflow-y-auto py-1 shadow-lg ${t.list}`}
                  >
                    {suggestions.map((s) => (
                      <li key={`${s.calle}|${s.altura ?? ""}|${s.localidad}|${s.lat}`} role="option" aria-selected={false}>
                        <button
                          type="button"
                          data-testid="home-address-suggestion"
                          // mousedown: the input blur would close the list before a click lands.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickSuggestion(s);
                          }}
                          tabIndex={-1}
                          className={`w-full px-4 py-2.5 text-left text-sm transition ${t.listItem}`}
                        >
                          {[s.calle, s.altura].filter(Boolean).join(" ")}
                          <span className={`block text-xs ${t.muted}`}>
                            {[s.localidad, s.partido].filter(Boolean).join(", ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <label className={t.label}>
                Piso / depto (opcional)
                <input
                  className={t.field}
                  data-testid="home-address-details"
                  maxLength={DETAILS_MAX_LENGTH}
                  value={homeAddress.details}
                  onChange={(e) => update({ details: e.target.value })}
                  placeholder="Ej. 3° B"
                />
              </label>
              <label className={t.label}>
                Indicaciones (opcional)
                <input
                  className={t.field}
                  data-testid="home-address-notes"
                  maxLength={NOTES_MAX_LENGTH}
                  value={homeAddress.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                  placeholder="Ej. portón negro, tocar timbre"
                />
              </label>
              {selected?.surcharge ? (
                <p className={`text-xs sm:col-span-2 ${t.muted}`}>
                  {selected.name} tiene un recargo por zona de ${formatSurcharge(selected.surcharge)}.
                </p>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
