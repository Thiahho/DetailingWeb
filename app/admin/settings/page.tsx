// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { isAuthenticated, logout, fetchWithAuth } from "../../../src/lib/auth";

// export default function SettingsPage() {
//   const router = useRouter();
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);

//   const [settings, setSettings] = useState({
//     daysOfWeek: [1, 2, 3, 4, 5], // Lun-Vie
//     startTime: "09:00",
//     endTime: "19:00",
//     slotDuration: 120,
//     breakBetweenSlots: 15,
//     maxDaysInAdvance: 30,
//   });

//   const [blockedDate, setBlockedDate] = useState({
//     date: "",
//     reason: "",
//   });

//   const [blockedDates, setBlockedDates] = useState<any[]>([]);

//   const daysLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

//   useEffect(() => {
//     if (!isAuthenticated()) {
//       router.push("/admin/login");
//     } else {
//       loadSettings();
//       loadBlockedDates();
//     }
//   }, [router]);

//   const loadSettings = async () => {
//     try {
//       const response = await fetchWithAuth(
//         "http://localhost:5048/api/businesssettings"
//       );
//       if (response.ok) {
//         const data = await response.json();
//         if (data) {
//           setSettings({
//             daysOfWeek: data.daysOfWeek || [1, 2, 3, 4, 5],
//             startTime: data.startTime || "09:00",
//             endTime: data.endTime || "19:00",
//             slotDuration: data.slotDuration || 120,
//             breakBetweenSlots: data.breakBetweenSlots || 15,
//             maxDaysInAdvance: data.maxDaysInAdvance || 30,
//           });
//         }
//       }
//     } catch (error) {
//       console.error("Error cargando configuración:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const loadBlockedDates = async () => {
//     try {
//       const response = await fetchWithAuth(
//         "http://localhost:5048/api/blockeddates"
//       );
//       if (response.ok) {
//         const data = await response.json();
//         setBlockedDates(data);
//       }
//     } catch (error) {
//       console.error("Error cargando fechas bloqueadas:", error);
//     }
//   };

//   const toggleDay = (day: number) => {
//     if (settings.daysOfWeek.includes(day)) {
//       setSettings({
//         ...settings,
//         daysOfWeek: settings.daysOfWeek.filter((d) => d !== day),
//       });
//     } else {
//       setSettings({
//         ...settings,
//         daysOfWeek: [...settings.daysOfWeek, day].sort(),
//       });
//     }
//   };

//   const saveSettings = async () => {
//     setSaving(true);
//     try {
//       const response = await fetchWithAuth(
//         "http://localhost:5048/api/businesssettings",
//         {
//           method: "PUT",
//           body: JSON.stringify(settings),
//         }
//       );

//       if (response.ok) {
//         alert("✅ Configuración guardada. Turnos regenerados automáticamente.");
//       } else {
//         alert("❌ Error al guardar configuración");
//       }
//     } catch (error) {
//       alert("❌ Error de conexión");
//       console.error(error);
//     } finally {
//       setSaving(false);
//     }
//   };

//   const blockDate = async (e: React.FormEvent) => {
//     e.preventDefault();
//     try {
//       const response = await fetchWithAuth(
//         "http://localhost:5048/api/blockeddates",
//         {
//           method: "POST",
//           body: JSON.stringify(blockedDate),
//         }
//       );

//       if (response.ok) {
//         alert("✅ Fecha bloqueada");
//         setBlockedDate({ date: "", reason: "" });
//         loadBlockedDates();
//       } else {
//         alert("❌ Error al bloquear fecha");
//       }
//     } catch (error) {
//       alert("❌ Error de conexión");
//       console.error(error);
//     }
//   };

//   const deleteBlockedDate = async (id: number) => {
//     if (!confirm("¿Eliminar esta fecha bloqueada?")) return;

//     try {
//       const response = await fetchWithAuth(
//         `http://localhost:5048/api/blockeddates/${id}`,
//         {
//           method: "DELETE",
//         }
//       );

//       if (response.ok) {
//         alert("✅ Fecha desbloqueada");
//         loadBlockedDates();
//       }
//     } catch (error) {
//       console.error(error);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex min-h-screen items-center justify-center bg-midnight">
//         <p className="text-white">Cargando...</p>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-midnight p-6">
//       <div className="mx-auto max-w-6xl">
//         <div className="mb-8 flex items-center justify-between">
//           <h1 className="text-3xl font-bold text-white">
//             Configuración de Turnos
//           </h1>
//           <button
//             onClick={logout}
//             className="rounded-lg border border-red-500/50 px-4 py-2 text-red-400 transition hover:bg-red-500/10"
//           >
//             Cerrar Sesión
//           </button>
//         </div>

//         <div className="grid gap-6 md:grid-cols-2">
//           {/* Configuración general */}
//           <div className="glass-card p-6 space-y-6">
//             <h2 className="text-xl font-semibold text-white">
//               Horario de Atención
//             </h2>

//             {/* Días laborales */}
//             <div>
//               <label className="text-white/70 text-sm mb-2 block">
//                 Días laborales
//               </label>
//               <div className="flex flex-wrap gap-2">
//                 {daysLabels.map((label, idx) => (
//                   <button
//                     key={idx}
//                     onClick={() => toggleDay(idx)}
//                     className={`px-4 py-2 rounded-lg transition ${
//                       settings.daysOfWeek.includes(idx)
//                         ? "bg-electric text-white"
//                         : "bg-white/10 text-white/50"
//                     }`}
//                   >
//                     {label}
//                   </button>
//                 ))}
//               </div>
//             </div>

//             {/* Horarios */}
//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <label className="text-white/70 text-sm">Hora inicio</label>
//                 <input
//                   type="time"
//                   className="form-input mt-2"
//                   value={settings.startTime}
//                   onChange={(e) =>
//                     setSettings({ ...settings, startTime: e.target.value })
//                   }
//                 />
//               </div>
//               <div>
//                 <label className="text-white/70 text-sm">Hora fin</label>
//                 <input
//                   type="time"
//                   className="form-input mt-2"
//                   value={settings.endTime}
//                   onChange={(e) =>
//                     setSettings({ ...settings, endTime: e.target.value })
//                   }
//                 />
//               </div>
//             </div>

//             {/* Duración y descanso */}
//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <label className="text-white/70 text-sm">
//                   Duración turno (min)
//                 </label>
//                 <input
//                   type="number"
//                   className="form-input mt-2"
//                   value={settings.slotDuration}
//                   onChange={(e) =>
//                     setSettings({
//                       ...settings,
//                       slotDuration: parseInt(e.target.value),
//                     })
//                   }
//                 />
//               </div>
//               <div>
//                 <label className="text-white/70 text-sm">Descanso (min)</label>
//                 <input
//                   type="number"
//                   className="form-input mt-2"
//                   value={settings.breakBetweenSlots}
//                   onChange={(e) =>
//                     setSettings({
//                       ...settings,
//                       breakBetweenSlots: parseInt(e.target.value),
//                     })
//                   }
//                 />
//               </div>
//             </div>

//             <div>
//               <label className="text-white/70 text-sm">
//                 Días de anticipación
//               </label>
//               <input
//                 type="number"
//                 className="form-input mt-2"
//                 value={settings.maxDaysInAdvance}
//                 onChange={(e) =>
//                   setSettings({
//                     ...settings,
//                     maxDaysInAdvance: parseInt(e.target.value),
//                   })
//                 }
//               />
//               <p className="mt-1 text-xs text-white/50">
//                 Turnos disponibles hasta N días adelante
//               </p>
//             </div>

//             <button
//               onClick={saveSettings}
//               disabled={saving}
//               className="w-full bg-electric text-white py-3 rounded-lg font-semibold transition hover:bg-electric/90 disabled:opacity-50"
//             >
//               {saving ? "Guardando..." : "Guardar y Regenerar Turnos"}
//             </button>
//           </div>

//           {/* Bloquear fechas */}
//           <div className="space-y-6">
//             <div className="glass-card p-6">
//               <h2 className="text-xl font-semibold text-white mb-4">
//                 Bloquear Fechas
//               </h2>
//               <form onSubmit={blockDate} className="space-y-4">
//                 <div>
//                   <label className="text-white/70 text-sm">Fecha</label>
//                   <input
//                     type="date"
//                     className="form-input mt-2"
//                     value={blockedDate.date}
//                     onChange={(e) =>
//                       setBlockedDate({ ...blockedDate, date: e.target.value })
//                     }
//                     required
//                   />
//                 </div>
//                 <div>
//                   <label className="text-white/70 text-sm">Motivo</label>
//                   <input
//                     type="text"
//                     className="form-input mt-2"
//                     placeholder="Ej: Feriado, Vacaciones"
//                     value={blockedDate.reason}
//                     onChange={(e) =>
//                       setBlockedDate({ ...blockedDate, reason: e.target.value })
//                     }
//                   />
//                 </div>
//                 <button
//                   type="submit"
//                   className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold"
//                 >
//                   Bloquear Fecha
//                 </button>
//               </form>
//             </div>

//             {/* Lista de fechas bloqueadas */}
//             <div className="glass-card p-6">
//               <h3 className="text-lg font-semibold text-white mb-4">
//                 Fechas Bloqueadas
//               </h3>
//               <div className="space-y-2 max-h-60 overflow-y-auto">
//                 {blockedDates.length === 0 ? (
//                   <p className="text-white/50 text-sm">
//                     No hay fechas bloqueadas
//                   </p>
//                 ) : (
//                   blockedDates.map((item) => (
//                     <div
//                       key={item.id}
//                       className="flex justify-between items-center p-3 bg-white/5 rounded-lg"
//                     >
//                       <div>
//                         <p className="text-white text-sm">
//                           {new Date(item.date).toLocaleDateString("es-AR")}
//                         </p>
//                         {item.reason && (
//                           <p className="text-white/50 text-xs">{item.reason}</p>
//                         )}
//                       </div>
//                       <button
//                         onClick={() => deleteBlockedDate(item.id)}
//                         className="text-red-400 hover:text-red-300 text-sm"
//                       >
//                         Eliminar
//                       </button>
//                     </div>
//                   ))
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
