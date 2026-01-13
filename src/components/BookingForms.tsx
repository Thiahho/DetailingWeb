"use client";

import { useState, type FormEvent } from "react";

// Generar slots de tiempo disponibles
const generateTimeSlots = () => {
  const slots: { date: Date; label: string }[] = [];
  const today = new Date();
  
  for (let i = 1; i <= 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    // Solo lunes a viernes
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    // Horarios: 9:00 a 18:15, cada 45 minutos
    for (let hour = 9; hour < 19; hour++) {
      for (let minute of [0, 45]) {
        if (hour === 18 && minute === 45) break;
        
        const slotDate = new Date(date);
        slotDate.setHours(hour, minute, 0, 0);
        
        slots.push({
          date: slotDate,
          label: slotDate.toLocaleDateString('es-AR', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          })
        });
      }
    }
    
    if (slots.length >= 40) break;
  }
  
  return slots;
};

export default function BookingForm() {
  const [formData, setFormData] = useState({
    name: "",
    vehicle: "",
    whatsapp: "",
    selectedSlot: null as Date | null,
    message: ""
  });

  const [showAllSlots, setShowAllSlots] = useState(false);
  const timeSlots = generateTimeSlots();
  const visibleSlots = showAllSlots ? timeSlots : timeSlots.slice(0, 12);

  const handleCalendarSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.selectedSlot) {
      alert('Por favor seleccioná un horario');
      return;
    }

    try {
      const response = await fetch('http://localhost:5048/api/calendar/turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          vehicle: formData.vehicle,
          whatsApp: formData.whatsapp,
          dateTime: formData.selectedSlot.toISOString(),
          message: formData.message
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('✅ Turno agendado exitosamente!');
        
        const whatsappMsg = `Turno confirmado para ${formData.vehicle} el ${formData.selectedSlot.toLocaleString('es-AR')}`;
        window.open(`https://wa.me/5491112345678?text=${encodeURIComponent(whatsappMsg)}`, '_blank');
        
        setFormData({ 
          name: "", 
          vehicle: "", 
          whatsapp: "", 
          selectedSlot: null, 
          message: "" 
        });
      } else {
        alert('❌ Error al agendar: ' + data.error);
      }
    } catch (error) {
      alert('❌ Error de conexión con el servidor');
      console.error(error);
    }
  };

  return (
    <form className="glass-card space-y-4 p-6" onSubmit={handleCalendarSubmit}>
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">Nombre</label>
        <input
          className="form-input mt-2"
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="Tu nombre"
          required
          value={formData.name}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">Vehículo</label>
        <input
          className="form-input mt-2"
          onChange={(e) => setFormData(prev => ({ ...prev, vehicle: e.target.value }))}
          placeholder="Modelo y año"
          required
          value={formData.vehicle}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">WhatsApp</label>
        <input
          className="form-input mt-2"
          onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
          placeholder="+54 9 11 1234 5678"
          required
          value={formData.whatsapp}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">
          Seleccioná tu turno
        </label>
        <div className="mt-3 grid max-h-[300px] gap-2 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-4 md:grid-cols-2">
          {visibleSlots.map((slot, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, selectedSlot: slot.date }))}
              className={`rounded-lg border px-4 py-3 text-left text-sm transition ${
                formData.selectedSlot?.getTime() === slot.date.getTime()
                  ? 'border-electric bg-electric/20 text-electric'
                  : 'border-white/10 hover:border-white/30 hover:bg-white/5'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>
        {!showAllSlots && timeSlots.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAllSlots(true)}
            className="mt-3 w-full rounded-lg border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/60 transition hover:border-electric/50 hover:text-white"
          >
            Ver más horarios ({timeSlots.length - 12} más)
          </button>
        )}
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-white/50">Consulta</label>
        <textarea
          className="form-input mt-2 min-h-[140px]"
          onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
          placeholder="¿Qué servicio buscás?"
          required
          value={formData.message}
        />
      </div>

      <button
        className="w-full rounded-full bg-electric px-6 py-3 text-sm font-semibold text-white shadow-glow transition hover:scale-[1.01]"
        type="submit"
      >
        Agendar turno
      </button>

      {formData.selectedSlot && (
        <p className="text-center text-xs text-white/50">
          Turno seleccionado: {formData.selectedSlot.toLocaleString('es-AR')}
        </p>
      )}
    </form>
  );
}