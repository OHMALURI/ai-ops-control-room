import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api.js';

const ServiceCard = ({ service }) => {
  const [latestEval, setLatestEval] = useState(null);
  const [allEvals, setAllEvals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);

  const fetchEvaluations = async () => {
    try {
      // Fetch latest evaluation
      try {
        const latestRes = await api.get(`/evaluations/latest/${service.id}`);
        setLatestEval(latestRes.data);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setLatestEval(null);
        } else {
          console.error("Failed to fetch latest evaluation", err);
        }
      }

      // Fetch all evaluations for the chart
      try {
        const allRes = await api.get(`/evaluations/${service.id}`);
        setAllEvals(allRes.data || []);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setAllEvals([]);
        } else {
          console.error("Failed to fetch all evaluations", err);
        }
      }
    } finally {
      setIsFetchingInitial(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [service.id]);

  const handleRunEvaluation = async () => {
    setIsLoading(true);
    try {
      await api.post(`/evaluations/run/${service.id}`);
      await fetchEvaluations();
    } catch (err) {
      console.error("Error running evaluation", err);
      alert("Failed to run evaluation for " + service.name);
    } finally {
      setIsLoading(false);
    }
  };

  // Metrics Logic
  const qualityScore = latestEval ? `${latestEval.quality_score.toFixed(1)}%` : "No data";
  const latency = "Run test first";
  
  // Calculate percentage of evaluations where score is below 50
  let errorRate = "0%";
  if (allEvals.length > 0) {
    const errorCount = allEvals.filter(e => e.quality_score < 50).length;
    errorRate = `${((errorCount / allEvals.length) * 100).toFixed(1)}%`;
  }

  const driftDetected = latestEval && latestEval.drift_triggered === true;
  
  const envText = service.environment || 'DEV';
  const isProd = envText.toLowerCase().includes('prod');
  const badgeColor = isProd ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200';

  // Chart Logic - recharts assumes data from left to right (oldest to newest)
  // The API returns timestamp descending, so we need to reverse the array
  const chartData = [...allEvals].reverse().map(e => {
    const dateObj = new Date(e.timestamp);
    return {
      time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullDate: dateObj.toLocaleString(),
      score: e.quality_score
    };
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full transition-shadow hover:shadow-md">
      <div className="p-6 border-b border-gray-100">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-xl font-bold text-gray-900 truncate" title={service.name}>
                {service.name}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                {envText.toUpperCase()}
              </span>
              {driftDetected && (
                <span className="bg-red-500 text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm animate-pulse">
                  DRIFT DETECTED
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm line-clamp-1" title={service.description}>
              {service.description || 'No description provided.'}
            </p>
          </div>
          <button 
            onClick={handleRunEvaluation} 
            disabled={isLoading || isFetchingInitial}
            className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center min-w-[150px]"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Running...
              </>
            ) : (
              'Run Evaluation'
            )}
          </button>
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Quality Score</p>
            <p className={`text-2xl font-bold ${
              latestEval 
                ? (latestEval.quality_score >= 80 ? 'text-green-600' : latestEval.quality_score >= 50 ? 'text-yellow-600' : 'text-red-600') 
                : 'text-gray-400'
            }`}>
              {qualityScore}
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Error Rate</p>
            <p className="text-2xl font-bold text-gray-800">{errorRate}</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg flex flex-col justify-center border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Latency</p>
            <p className="text-md font-medium text-gray-400 mt-1">{latency}</p>
          </div>
        </div>

        <div className="flex-grow min-h-[220px] w-full mt-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-4">Quality Score Over Time</h4>
          {allEvals.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <XAxis 
                  dataKey="time" 
                  stroke="#9ca3af" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  domain={[0, 100]} 
                  stroke="#9ca3af" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  name="Quality Score"
                  stroke="#4f46e5" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }} 
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg text-gray-400 bg-gray-50 pb-6">
              <svg className="w-8 h-8 text-gray-300 mb-2 mt-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span className="text-sm font-medium">No evaluation data available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await api.get('/services');
        setServices(response.data);
      } catch (err) {
        console.error("Failed to load services", err);
        setError("Failed to load operations data. Please ensure the backend is running.");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex justify-center items-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
          <p className="text-indigo-900 font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex justify-center items-start pt-20">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-r-lg shadow-sm max-w-2xl w-full">
          <h3 className="font-bold text-lg mb-2">Connection Error</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 px-2 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">AI Operations Dashboard</h1>
            <p className="text-slate-500 mt-2 text-lg">Monitor model performance, detect drift, and manage service health.</p>
          </div>
        </div>

        {services.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 text-center">
            <svg className="mx-auto h-16 w-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
            <h3 className="text-xl font-medium text-slate-900 mb-2">No Services Configured</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              You haven't added any services to the registry yet. Head over to the Service Registry to add your first AI model.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {services.map(service => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
