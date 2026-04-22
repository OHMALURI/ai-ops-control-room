import React from 'react';

export default function IncidentModal({
  isOpen,
  onClose,
  formData,
  setFormData,
  services,
  isSubmitting,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            File New Operational Incident
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Target Service Configuration</label>
              <select
                required
                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-3 border appearance-none bg-slate-50 transition-all font-sans"
                value={formData.service_id}
                onChange={e => setFormData({ ...formData, service_id: e.target.value })}
              >
                <option value="" disabled>Select the impacted service block...</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.environment})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Impact Severity Class</label>
              <select
                required
                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-3 border appearance-none bg-slate-50 transition-all font-sans"
                value={formData.severity}
                onChange={e => setFormData({ ...formData, severity: e.target.value })}
              >
                <option value="low">Low (Standard Anomaly)</option>
                <option value="medium">Medium (Operation Blocker)</option>
                <option value="high">High (Production System Failure)</option>
                <option value="critical">Critical (Safety/Integrity Drop)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Registered Symptoms</label>
            <textarea
              required
              rows={3}
              placeholder="Qualify standard model inaccuracies, latency spikes, or broken structural parameters..."
              className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-4 border bg-slate-50 transition-all resize-none font-sans"
              value={formData.symptoms}
              onChange={e => setFormData({ ...formData, symptoms: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 font-sans">Chronological Timeline</label>
            <textarea
              required
              rows={2}
              placeholder="10:30 UTC - Data format mismatch discovered. 10:45 UTC - System flagged parameter divergence..."
              className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-4 border bg-slate-50 transition-all resize-none font-sans"
              value={formData.timeline}
              onChange={e => setFormData({ ...formData, timeline: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all font-sans"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 text-sm font-sans"
            >
              {isSubmitting ? 'Transmitting...' : 'Submit Incident Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
