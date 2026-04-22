import React, { useState, useEffect } from 'react';
import api from '../api';

export default function MaintenancePlanModal({ isOpen, onClose, plan, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    risk_level: '',
    rollback_plan: '',
    validation_steps: '',
    next_eval_date: '',
    approved: false
  });

  useEffect(() => {
    if (plan) {
      setFormData({
        risk_level: plan.risk_level || 'low',
        rollback_plan: plan.rollback_plan || '',
        validation_steps: plan.validation_steps || '',
        next_eval_date: plan.next_eval_date ? plan.next_eval_date.split('T')[0] : '',
        approved: plan.approved || false
      });
      setIsEditing(false);
    }
  }, [plan]);

  if (!isOpen || !plan) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        next_eval_date: formData.next_eval_date ? new Date(formData.next_eval_date).toISOString() : null
      };
      const response = await api.put(`/maintenance/${plan.id}`, payload);
      onUpdate(response.data);
      setIsEditing(false);
    } catch (err) {
      console.error("Update failure:", err);
      alert("Failed to update maintenance plan");
    } finally {
      setIsSaving(false);
    }
  };

  const getRiskStyle = (risk) => {
    switch(risk?.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Incident Root Node</span>
              <span className="font-mono text-[10px] font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-600">INC-{plan.incident_id}</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Maintenance Configuration</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {!isEditing ? (
            /* View Mode */
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operational Risk</p>
                  <span className={`px-3 py-1 rounded-lg border text-[10px] font-bold uppercase ${getRiskStyle(plan.risk_level)}`}>
                    {plan.risk_level} Risk
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Evaluation Checkpoint</p>
                  <p className="text-sm font-bold text-slate-700">
                    {plan.next_eval_date ? new Date(plan.next_eval_date).toLocaleDateString() : 'TBD'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Rollback Constraint</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-sm text-slate-600 leading-relaxed shadow-inner">
                  "{plan.rollback_plan}"
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Validation Protocol</p>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {plan.validation_steps}
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                <div className="flex items-center gap-2">
                   <div className={`w-3 h-3 rounded-full ${plan.approved ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'}`} />
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                     Status: {plan.approved ? 'Approved Rollout' : 'Awaiting Review'}
                   </span>
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  Edit Configuration
                </button>
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Risk Level</label>
                  <select 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={formData.risk_level}
                    onChange={e => setFormData({...formData, risk_level: e.target.value})}
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Next Eval Date</label>
                  <input 
                    type="date"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={formData.next_eval_date}
                    onChange={e => setFormData({...formData, next_eval_date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Rollback Plan</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
                  value={formData.rollback_plan}
                  onChange={e => setFormData({...formData, rollback_plan: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Validation Steps</label>
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[120px]"
                  value={formData.validation_steps}
                  onChange={e => setFormData({...formData, validation_steps: e.target.value})}
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <input 
                  type="checkbox"
                  id="approved-check"
                  className="h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={formData.approved}
                  onChange={e => setFormData({...formData, approved: e.target.checked})}
                />
                <label htmlFor="approved-check" className="text-xs font-bold text-indigo-900 cursor-pointer select-none">
                  Plan Approved for Execution
                </label>
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all font-sans"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] px-6 py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Synchronizing...' : 'Save Configuration Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
