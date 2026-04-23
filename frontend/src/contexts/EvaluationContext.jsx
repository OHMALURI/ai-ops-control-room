import { createContext, useContext, useRef, useState, useCallback } from 'react';
import api from '../api.js';

const BASE_URL = 'http://localhost:8000/api';

const EvaluationContext = createContext(null);

export function EvaluationProvider({ children }) {
  // per-service state: { [serviceId]: { steps, isLoading, finished } }
  const [evalState, setEvalState] = useState({});

  // refs that don't trigger re-renders
  const eventSourceRefs = useRef({});  // serviceId → EventSource
  const terminalRefs    = useRef({});  // serviceId → bool

  const _setState = useCallback((serviceId, patch) => {
    setEvalState(prev => ({
      ...prev,
      [serviceId]: { ...(prev[serviceId] ?? { steps: [], isLoading: false, finished: false }), ...patch },
    }));
  }, []);

  const _appendStep = useCallback((serviceId, step) => {
    setEvalState(prev => {
      const cur = prev[serviceId] ?? { steps: [], isLoading: false, finished: false };
      const steps = cur.steps;
      if (step.status === 'qa_pair') {
        return { ...prev, [serviceId]: { ...cur, steps: [...steps, step] } };
      }
      const idx = steps.findIndex(s => s.step === step.step);
      const newSteps = idx >= 0
        ? steps.map((s, i) => (i === idx ? step : s))
        : [...steps, step];
      return { ...prev, [serviceId]: { ...cur, steps: newSteps } };
    });
  }, []);

  const startEval = useCallback((serviceId, onComplete) => {
    // Close any existing stream for this service
    if (eventSourceRefs.current[serviceId]) {
      eventSourceRefs.current[serviceId].close();
    }

    terminalRefs.current[serviceId] = false;
    _setState(serviceId, { steps: [], isLoading: true, finished: false });

    const token = localStorage.getItem('token') || '';
    const es = new EventSource(`${BASE_URL}/evaluations/run-stream/${serviceId}?token=${encodeURIComponent(token)}`);
    eventSourceRefs.current[serviceId] = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      _appendStep(serviceId, data);

      if (['complete', 'error', 'stopped'].includes(data.status)) {
        terminalRefs.current[serviceId] = true;
        es.close();
        delete eventSourceRefs.current[serviceId];
        _setState(serviceId, { isLoading: false, finished: true });
        onComplete?.();
      }
    };

    es.onerror = () => {
      if (terminalRefs.current[serviceId]) return;
      es.close();
      delete eventSourceRefs.current[serviceId];
      _appendStep(serviceId, { step: 'conn_error', label: 'Connection lost', status: 'error' });
      _setState(serviceId, { isLoading: false, finished: true });
    };
  }, [_setState, _appendStep]);

  const stopEval = useCallback(async (serviceId) => {
    try {
      await api.post(`/evaluations/stop/${serviceId}`);
    } catch (e) {
      console.error('Stop request failed', e);
    }
  }, []);

  const clearProgress = useCallback((serviceId) => {
    _setState(serviceId, { steps: [], finished: false });
  }, [_setState]);

  const getState = useCallback((serviceId) => {
    return evalState[serviceId] ?? { steps: [], isLoading: false, finished: false };
  }, [evalState]);

  const isRunning = useCallback((serviceId) => {
    return !!eventSourceRefs.current[serviceId];
  }, []);

  return (
    <EvaluationContext.Provider value={{ startEval, stopEval, clearProgress, getState, isRunning }}>
      {children}
    </EvaluationContext.Provider>
  );
}

export function useEvaluation() {
  return useContext(EvaluationContext);
}
