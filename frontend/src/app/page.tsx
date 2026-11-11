"use client";

import React, { useState, useEffect } from "react";
import {
  fetchTrains,
  fetchTrainLayout,
  createBookingHold,
  confirmPayment,
  cancelBooking,
  lookupPNR,
  fetchReservationChart,
  fetchDSAMetrics,
} from "@/lib/api";
import {
  Train,
  CreditCard,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  BarChart3,
  Users,
  Clock,
  ShieldCheck,
  ChevronRight,
  XCircle,
  Trash2,
  Copy,
  Check,
  Info,
  Sparkles,
  UserPlus,
} from "lucide-react";

export default function RailwayApp() {
  const [activeTab, setActiveTab] = useState<"search" | "pnr" | "chart" | "dsa">("search");
  const [trains, setTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Floating Toast Notifications System
  const [toasts, setToasts] = useState<
    Array<{ id: string; type: "success" | "error" | "warning" | "info"; title: string; message: string }>
  >([]);

  const notify = (type: "success" | "error" | "warning" | "info", title: string, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const copyToClipboard = (text: string, label: string = "PNR") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      notify("info", `${label} Copied!`, `${text} has been copied to your clipboard.`);
    }
  };

  // Booking Flow States
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<any>(null);
  const [coachLayout, setCoachLayout] = useState<any>(null);
  const [quota, setQuota] = useState("GN");
  const [passengers, setPassengers] = useState([
    { name: "", age: 30, gender: "M", berth_preference: "LOWER" },
  ]);
  const [holdResult, setHoldResult] = useState<any>(null);
  const [holdTimeLeft, setHoldTimeLeft] = useState<number>(300);
  const [bookingConfirmed, setBookingConfirmed] = useState<any>(null);

  // PNR Search State
  const [pnrQuery, setPnrQuery] = useState("");
  const [pnrResult, setPnrResult] = useState<any>(null);
  const [pnrError, setPnrError] = useState<any>(null);

  // Chart State
  const [chartRunId, setChartRunId] = useState<number>(1);
  const [chartData, setChartData] = useState<any>(null);

  // DSA Metrics State
  const [dsaMetrics, setDsaMetrics] = useState<any>(null);

  const loadLayout = async (runId: number) => {
    try {
      const data = await fetchTrainLayout(runId);
      setCoachLayout(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadTrains = async () => {
    setLoading(true);
    try {
      const data = await fetchTrains();
      setTrains(data);
      if (data.length > 0 && data[0].runs.length > 0) {
        setSelectedRunId(data[0].runs[0].run_id);
        setSelectedTrain(data[0]);
        loadLayout(data[0].runs[0].run_id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load trains");
    } finally {
      setLoading(false);
    }
  };

  const loadDSAMetrics = async () => {
    try {
      const data = await fetchDSAMetrics();
      setDsaMetrics(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load initial trains
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const [trainsData, dsaData] = await Promise.all([fetchTrains(), fetchDSAMetrics()]);
        if (!mounted) return;
        setTrains(trainsData);
        setDsaMetrics(dsaData);
        if (trainsData.length > 0 && trainsData[0].runs.length > 0) {
          const firstRunId = trainsData[0].runs[0].run_id;
          setSelectedRunId(firstRunId);
          setSelectedTrain(trainsData[0]);
          const layoutData = await fetchTrainLayout(firstRunId);
          if (mounted) setCoachLayout(layoutData);
        }
      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to load initial data");
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Timer countdown for held seat
  useEffect(() => {
    if (!holdResult || bookingConfirmed) return;
    const interval = setInterval(() => {
      setHoldTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setHoldResult(null);
          setError("Your 5-minute seat hold expired. Berths released.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdResult, bookingConfirmed]);

  const handleRunSelect = (train: any, run: any) => {
    setSelectedTrain(train);
    setSelectedRunId(run.run_id);
    loadLayout(run.run_id);
    setHoldResult(null);
    setBookingConfirmed(null);
  };

  const handleAddPassenger = () => {
    if (passengers.length >= 4) return;
    setPassengers([...passengers, { name: "", age: 28, gender: "M", berth_preference: "LOWER" }]);
  };

  const handleRemovePassenger = (idx: number) => {
    if (passengers.length === 1) return;
    setPassengers(passengers.filter((_, i) => i !== idx));
  };

  const handlePassengerChange = (index: number, field: string, value: any) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const handleHoldBooking = async () => {
    if (!selectedRunId) return;
    for (const p of passengers) {
      if (!p.name.trim()) {
        const msg = "Please enter names for all passengers.";
        setError(msg);
        notify("warning", "Missing Passenger Info", msg);
        return;
      }
    }
    setError(null);
    setLoading(true);
    try {
      const res = await createBookingHold({
        train_run_id: selectedRunId,
        quota,
        passengers,
      });
      setHoldResult(res);
      setHoldTimeLeft(300);
      loadDSAMetrics();
      if (selectedRunId) loadLayout(selectedRunId);
      notify(
        "success",
        "Temporary Seat Hold Active",
        `PNR ${res.pnr} held (${res.booking_status}). 5-minute payment countdown started.`
      );
    } catch (err: any) {
      setError(err.message);
      notify("error", "Seat Hold Failed", err.message || "Failed to hold berths.");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (success: boolean) => {
    if (!holdResult) return;
    setLoading(true);
    setError(null);
    try {
      const res = await confirmPayment({
        pnr: holdResult.pnr,
        amount: 500 * holdResult.passengers.length,
        simulate_success: success,
      });
      setBookingConfirmed(res);
      setHoldResult(null);
      loadDSAMetrics();
      if (selectedRunId) loadLayout(selectedRunId);
      if (success) {
        notify(
          "success",
          "Booking Confirmed!",
          `PNR ${res.pnr} is confirmed and indexed into the Custom PNR Hash Table & Bloom Filter.`
        );
      } else {
        notify(
          "warning",
          "Payment Simulation Failed",
          "Held berths have been released back to the train availability pool."
        );
      }
    } catch (err: any) {
      setError(err.message);
      setHoldResult(null);
      notify("error", "Payment Error", err.message || "Payment confirmation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePNRLookup = async () => {
    if (!pnrQuery.trim()) {
      notify("warning", "PNR Required", "Please enter a valid 10-digit PNR number.");
      return;
    }
    setPnrError(null);
    setPnrResult(null);
    setLoading(true);
    try {
      const data = await lookupPNR(pnrQuery.trim());
      setPnrResult(data);
      notify(
        "success",
        "PNR Record Located",
        `PNR ${data.pnr} verified via Bloom filter pre-check and O(1) Hash Table lookup.`
      );
    } catch (err: any) {
      setPnrError(err.detail || { message: "Failed to locate PNR." });
      notify(
        "error",
        "PNR Not Found",
        err.detail?.message || "Bloom Filter fast-rejection: PNR does not exist in system."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPassenger = async (pnr: string, passengerId?: number) => {
    setLoading(true);
    try {
      await cancelBooking({ pnr, passenger_id: passengerId });
      handlePNRLookup();
      loadDSAMetrics();
      if (selectedRunId) loadLayout(selectedRunId);
      notify(
        "info",
        "Cancellation Processed",
        "Berth released. Waiting list priority heap automatically evaluated for promotion."
      );
    } catch (err: any) {
      setError(err.message);
      notify("error", "Cancellation Failed", err.message || "Failed to cancel booking.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadChart = async (runId: number) => {
    setLoading(true);
    try {
      const data = await fetchReservationChart(runId);
      setChartData(data);
      setChartRunId(runId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="/icon.svg"
            alt="RailDSA Engine Logo"
            className="h-11 w-11 rounded-xl shadow-lg shadow-indigo-500/25 hover:scale-105 transition-transform cursor-pointer"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              RailDSA Engine
            </h1>
            <p className="text-xs text-indigo-400 font-medium tracking-wide">
              Priority Waiting-List & In-Memory Hash/Heap Core
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === "search"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Train className="h-4 w-4" />
            <span>Search & Book</span>
          </button>
          <button
            onClick={() => setActiveTab("pnr")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === "pnr"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Search className="h-4 w-4" />
            <span>PNR Status</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("chart");
              if (!chartData && selectedRunId) handleLoadChart(selectedRunId);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === "chart"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Reservation Chart</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("dsa");
              loadDSAMetrics();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 ${
              activeTab === "dsa"
                ? "bg-indigo-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Database className="h-4 w-4" />
            <span>DSA Diagnostics</span>
          </button>
        </nav>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-rose-950/80 border-b border-rose-800 px-6 py-3 text-rose-200 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* ===================== TAB 1: SEARCH & BOOK ===================== */}
        {activeTab === "search" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5 Cols: Train List & Quota */}
            <div className="lg:col-span-5 space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold flex items-center space-x-2">
                    <Train className="h-4 w-4 text-indigo-400" />
                    <span>Select Train & Run Date</span>
                  </h2>
                  <button
                    onClick={loadTrains}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="space-y-3">
                  {trains.map((t) => (
                    <div
                      key={t.id}
                      className="border border-slate-800 rounded-xl p-3.5 bg-slate-950/50 hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-indigo-400 text-sm">
                              {t.train_number}
                            </span>
                            <span className="font-semibold text-sm">{t.train_name}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {t.source_station} &rarr; {t.destination_station}
                          </p>
                        </div>
                      </div>

                      {/* Train Runs Buttons */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {t.runs.map((r: any) => (
                          <button
                            key={r.run_id}
                            onClick={() => handleRunSelect(t, r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center space-x-2 ${
                              selectedRunId === r.run_id
                                ? "bg-indigo-600/30 border-indigo-500 text-indigo-200"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            <span>{r.run_date}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                r.available_berths > 0
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : "bg-amber-950 text-amber-400 border border-amber-800"
                              }`}
                            >
                              {r.available_berths > 0
                                ? `AVL ${r.available_berths}`
                                : "WL / RAC"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quota Selection */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center space-x-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <span>Reservation Quota Prioritization</span>
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: "GN", name: "General (GN)", desc: "Standard priority" },
                    { id: "SS", name: "Senior Citizen (SS)", desc: "Priority 1 for allocation" },
                    { id: "LD", name: "Ladies Quota (LD)", desc: "Priority 2 for allocation" },
                    { id: "TQ", name: "Tatkal (TQ)", desc: "Short-notice waitlist" },
                  ].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setQuota(q.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        quota === q.id
                          ? "bg-indigo-600/20 border-indigo-500 text-white"
                          : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <div className="font-semibold">{q.name}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{q.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 7 Cols: Passenger Details & Live Coach Map */}
            <div className="lg:col-span-7 space-y-5">
              {/* Live Coach Berth Layout Map */}
              {coachLayout && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-300">
                      Live Coach Layout: {coachLayout.train_name} ({coachLayout.train_number})
                    </h2>
                    <span className="text-xs text-slate-400">Date: {coachLayout.run_date}</span>
                  </div>

                  <div className="space-y-4">
                    {coachLayout.coaches.map((c: any) => (
                      <div
                        key={c.coach_code}
                        className="bg-slate-950/60 border border-slate-800 rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-indigo-300">
                            Coach {c.coach_code} ({c.coach_type})
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Total Berths: {c.total_berths}
                          </span>
                        </div>
                        {/* Berths Grid */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                          {c.berths.map((b: any) => {
                            let badgeBg = "bg-emerald-950/60 border-emerald-800 text-emerald-300";
                            if (b.status === "HELD")
                              badgeBg = "bg-amber-950/60 border-amber-800 text-amber-300";
                            else if (b.status === "CONFIRMED")
                              badgeBg = "bg-rose-950/60 border-rose-800 text-rose-300";

                            return (
                              <div
                                key={b.id}
                                className={`border rounded-lg p-1.5 text-center transition ${badgeBg}`}
                              >
                                <div className="text-[11px] font-bold">{b.berth_number}</div>
                                <div className="text-[9px] opacity-75">{b.berth_type[0]}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center space-x-4 mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                    <span className="flex items-center space-x-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                      <span>Available</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                      <span>Held (5m TTL)</span>
                    </span>
                    <span className="flex items-center space-x-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                      <span>Confirmed</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Passenger Booking Entry & Hold Status */}
              {!holdResult && !bookingConfirmed && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-indigo-950/80 border border-indigo-800/60 rounded-xl text-indigo-400">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white tracking-wide">Passenger Details</h3>
                        <p className="text-[11px] text-slate-400">Specify passenger details and preferred berths (Max 4)</p>
                      </div>
                    </div>
                    <button
                      onClick={handleAddPassenger}
                      disabled={passengers.length >= 4}
                      className="px-3.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/50 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold rounded-xl text-indigo-300 transition flex items-center space-x-1.5 shadow-sm"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Add Passenger ({passengers.length}/4)</span>
                    </button>
                  </div>

                  <div className="space-y-3.5">
                    {passengers.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl transition space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-300 flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-700/80 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                              {idx + 1}
                            </span>
                            <span>Passenger #{idx + 1}</span>
                          </span>
                          {passengers.length > 1 && (
                            <button
                              onClick={() => handleRemovePassenger(idx)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-950/30 transition text-xs flex items-center space-x-1"
                              title="Remove passenger"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="text-[11px]">Remove</span>
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div className="sm:col-span-5">
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Full Name (as per Govt ID)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Rahul Sharma"
                              value={p.name}
                              onChange={(e) => handlePassengerChange(idx, "name", e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 transition outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Age
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={120}
                              placeholder="Age"
                              value={p.age}
                              onChange={(e) =>
                                handlePassengerChange(idx, "age", parseInt(e.target.value) || 0)
                              }
                              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3 py-2 text-xs text-white transition outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Gender
                            </label>
                            <select
                              value={p.gender}
                              onChange={(e) => handlePassengerChange(idx, "gender", e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-2.5 py-2 text-xs text-white transition outline-none cursor-pointer"
                            >
                              <option value="M">Male</option>
                              <option value="F">Female</option>
                              <option value="O">Other</option>
                            </select>
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-medium text-slate-400 mb-1">
                              Berth Preference
                            </label>
                            <select
                              value={p.berth_preference}
                              onChange={(e) =>
                                handlePassengerChange(idx, "berth_preference", e.target.value)
                              }
                              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-2.5 py-2 text-xs text-white transition outline-none cursor-pointer"
                            >
                              <option value="LOWER">Lower Berth</option>
                              <option value="MIDDLE">Middle Berth</option>
                              <option value="UPPER">Upper Berth</option>
                              <option value="SIDE_LOWER">Side Lower</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleHoldBooking}
                    disabled={loading}
                    className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition text-sm flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <span>Request Temporary Berth Hold (5 Min TTL)</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Temporary Hold Modal / Section */}
              {holdResult && !bookingConfirmed && (
                <div className="bg-slate-900 border-2 border-indigo-500/80 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-amber-400 font-bold flex items-center space-x-1.5">
                        <Clock className="h-4 w-4" />
                        <span>Seat Hold Active (Status: {holdResult.booking_status})</span>
                      </span>
                      <h3 className="text-xl font-extrabold text-white mt-1">
                        PNR: {holdResult.pnr}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-mono font-bold text-amber-400">
                        {Math.floor(holdTimeLeft / 60)}:
                        {(holdTimeLeft % 60).toString().padStart(2, "0")}
                      </div>
                      <span className="text-[10px] text-slate-400">Time to Complete Payment</span>
                    </div>
                  </div>

                  <div className="py-4 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase">
                      Held Berths / Waiting Allocations:
                    </h4>
                    {holdResult.passengers.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg text-xs"
                      >
                        <span className="font-semibold text-slate-200">{p.name}</span>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                            p.status === "HELD_CNF"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-amber-950 text-amber-400 border border-amber-800"
                          }`}
                        >
                          {p.status === "HELD_CNF"
                            ? `Berth: ${p.coach_code || "S1"}-${p.berth_number} (${p.berth_type})`
                            : `Waiting List: WL #${p.wl_number || 1}`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Payment Simulator Actions */}
                  <div className="pt-2 border-t border-slate-800 flex items-center space-x-3">
                    <button
                      onClick={() => handlePayment(true)}
                      disabled={loading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl transition text-xs flex items-center justify-center space-x-2"
                    >
                      <CreditCard className="h-4 w-4" />
                      <span>Simulate Successful Payment (₹{500 * holdResult.passengers.length})</span>
                    </button>
                    <button
                      onClick={() => handlePayment(false)}
                      disabled={loading}
                      className="bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 px-4 py-2.5 rounded-xl transition text-xs"
                    >
                      Simulate Failure
                    </button>
                  </div>
                </div>
              )}

              {/* Booking Confirmation Card */}
              {bookingConfirmed && (
                <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center space-x-3 mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        Booking Finalized! PNR: {bookingConfirmed.pnr}
                      </h3>
                      <p className="text-xs text-emerald-400 font-medium">
                        Indexed in Custom PNR Hash Table & Bloom Filter
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    {bookingConfirmed.passengers.map((p: any) => (
                      <div
                        key={p.id}
                        className="bg-slate-950 p-3 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">{p.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Age: {p.age} | Gender: {p.gender}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`font-mono font-bold px-2.5 py-1 rounded text-xs ${
                              p.status === "CNF"
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : "bg-amber-950 text-amber-300 border border-amber-800"
                            }`}
                          >
                            {p.status === "CNF"
                              ? `CONFIRMED: ${p.coach_code}-${p.berth_number} (${p.berth_type})`
                              : `WAITING LIST: WL #${p.wl_number}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setBookingConfirmed(null);
                      setHoldResult(null);
                      setPassengers([
                        { name: "", age: 30, gender: "M", berth_preference: "LOWER" },
                      ]);
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-xl text-xs transition"
                  >
                    Book Another Journey
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: PNR STATUS & LOOKUP ===================== */}
        {activeTab === "pnr" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-950/80 border border-indigo-800/60 rounded-xl text-indigo-400">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Custom PNR Search with Bloom Filter Fast-Rejection
                  </h2>
                  <p className="text-xs text-slate-400">
                    Demonstrates the probabilistic Bloom filter O(k) pre-check: if absent, rejects immediately without querying the custom hash table or database.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter 10-digit PNR (e.g. 0342926924)"
                    value={pnrQuery}
                    onChange={(e) => setPnrQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl pl-4 pr-10 py-3 text-sm text-white focus:outline-none font-mono tracking-wider placeholder:tracking-normal placeholder-slate-500 transition"
                  />
                  {pnrQuery && (
                    <button
                      onClick={() => setPnrQuery("")}
                      className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 text-sm font-bold"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <button
                  onClick={handlePNRLookup}
                  disabled={loading}
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  <span>Lookup PNR</span>
                </button>
              </div>

              {/* Quick Preset / Demo PNR Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium flex items-center space-x-1">
                  <Sparkles className="h-3 w-3 text-indigo-400" />
                  <span>Try Demo PNRs:</span>
                </span>
                {["0342926924", "4883246767", "9999999999"].map((demoPnr) => (
                  <button
                    key={demoPnr}
                    onClick={() => {
                      setPnrQuery(demoPnr);
                      lookupPNR(demoPnr)
                        .then((data) => {
                          setPnrResult(data);
                          setPnrError(null);
                          notify("success", "PNR Located", `Demo PNR ${demoPnr} verified.`);
                        })
                        .catch((err) => {
                          setPnrError(err.detail || { message: "PNR Not Found" });
                          setPnrResult(null);
                          notify("error", "Bloom Fast-Rejection", "Non-existent PNR rejected in O(k).");
                        });
                    }}
                    className="px-2.5 py-1 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-400 hover:text-indigo-300 font-mono text-[11px] transition"
                  >
                    {demoPnr === "9999999999" ? `${demoPnr} (Non-existent)` : demoPnr}
                  </button>
                ))}
              </div>
            </div>

            {/* Error or Fast Rejection Result */}
            {pnrError && (
              <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-5 text-rose-200">
                <div className="flex items-center space-x-3 mb-2">
                  <XCircle className="h-6 w-6 text-rose-400" />
                  <span className="font-bold text-sm">
                    {pnrError.message || "PNR Not Found in System"}
                  </span>
                </div>
                {pnrError.bloom_filter_pre_check === false && (
                  <div className="text-xs bg-slate-950/60 p-3 rounded-xl border border-rose-900/60 font-mono">
                    <span className="text-indigo-400 font-semibold">[Bloom Filter Pre-check]:</span>{" "}
                    Query returned FALSE. Definitively absent from system. Execution bypassed
                    database lookup.
                  </div>
                )}
              </div>
            )}

            {/* Success PNR Result */}
            {pnrResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-xs text-slate-400">PNR Inquiry Status</span>
                    <div className="flex items-center space-x-2.5 mt-0.5">
                      <h3 className="text-xl font-bold font-mono text-white">{pnrResult.pnr}</h3>
                      <button
                        onClick={() => copyToClipboard(pnrResult.pnr)}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        title="Copy PNR"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      pnrResult.booking_status === "CONFIRMED"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        : pnrResult.booking_status === "CANCELLED"
                        ? "bg-rose-950 text-rose-300 border border-rose-800"
                        : "bg-amber-950 text-amber-300 border border-amber-800"
                    }`}
                  >
                    {pnrResult.booking_status}
                  </span>
                </div>

                {/* Academic DSA Audit Badge */}
                {pnrResult.dsa_audit && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-indigo-950 text-xs space-y-1">
                    <div className="text-indigo-400 font-semibold flex items-center space-x-1.5">
                      <ShieldCheck className="h-4 w-4" />
                      <span>DSA Pipeline Verification</span>
                    </div>
                    <div className="text-slate-400 text-[11px] grid grid-cols-2 gap-2 pt-1 font-mono">
                      <div>
                        Bloom Pre-Check:{" "}
                        <span className="text-emerald-400">PASSED (Positive)</span>
                      </div>
                      <div>
                        Hash Table Lookup:{" "}
                        <span className="text-emerald-400">O(1) HIT</span>
                      </div>
                      <div>
                        Hash Table Load Factor:{" "}
                        <span className="text-slate-200">
                          {pnrResult.dsa_audit.hash_table_metrics.load_factor}
                        </span>
                      </div>
                      <div>
                        Bloom FP Rate:{" "}
                        <span className="text-slate-200">
                          {pnrResult.dsa_audit.bloom_filter_metrics.theoretical_fp_rate}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Passenger Records */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-300">Passenger Statuses:</h4>
                  {pnrResult.passengers.map((p: any) => (
                    <div
                      key={p.id}
                      className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[11px] text-slate-400">
                          Age: {p.age} | Quota: {pnrResult.quota}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-indigo-300">
                          {p.status === "CNF"
                            ? `${p.coach_code}-${p.berth_number} (${p.berth_type})`
                            : p.status}
                        </span>
                        {p.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancelPassenger(pnrResult.pnr, p.id)}
                            className="text-xs bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 px-2.5 py-1 rounded-lg transition"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: RESERVATION CHART ===================== */}
        {activeTab === "chart" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-indigo-400" />
                  <span>Reservation Chart (Custom Merge-Sort Order)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Sorted strictly by:{" "}
                  <code className="text-indigo-300">1. Coach Identifier ASC</code> &rarr;{" "}
                  <code className="text-indigo-300">2. Berth Number ASC</code> using academic Merge
                  Sort.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <select
                  value={chartRunId}
                  onChange={(e) => handleLoadChart(parseInt(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                >
                  {trains.flatMap((t) =>
                    t.runs.map((r: any) => (
                      <option key={r.run_id} value={r.run_id}>
                        {t.train_number} - {r.run_date}
                      </option>
                    ))
                  )}
                </select>
                <button
                  onClick={() => handleLoadChart(chartRunId)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 transition"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {chartData && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>
                    Train: {chartData.train_name} ({chartData.train_number}) | Run Date:{" "}
                    {chartData.run_date}
                  </span>
                  <span className="text-indigo-400 font-mono">
                    {chartData.sorting_algorithm_used}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Coach</th>
                        <th className="py-3 px-4">Berth No</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Passenger Name</th>
                        <th className="py-3 px-4">Age / Gender</th>
                        <th className="py-3 px-4">Quota</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {chartData.sorted_chart.map((row: any, i: number) => (
                        <tr
                          key={i}
                          className={`hover:bg-slate-800/30 transition ${
                            row.status === "AVAILABLE" ? "opacity-60" : ""
                          }`}
                        >
                          <td className="py-2.5 px-4 font-bold text-indigo-400">
                            {row.coach_code}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold">
                            {row.berth_number}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">{row.berth_type}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.status === "AVAILABLE"
                                  ? "bg-slate-800 text-slate-400"
                                  : row.status === "HELD"
                                  ? "bg-amber-950 text-amber-300 border border-amber-800"
                                  : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-medium text-white">
                            {row.passenger_name}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">
                            {row.age ? `${row.age} / ${row.gender}` : "-"}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400">{row.quota || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Waiting List Priority Queue Table */}
                {chartData.waiting_list && chartData.waiting_list.length > 0 && (
                  <div className="p-5 border-t border-slate-800 bg-slate-950/40">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">
                      Active Waiting List Heap (Priority Ordered)
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {chartData.waiting_list.map((wl: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-white">Priority #{idx + 1}</span>
                            <div className="text-[10px] text-slate-400">PNR: {wl.pnr}</div>
                          </div>
                          <span className="bg-amber-950 text-amber-300 border border-amber-800 text-[10px] px-2 py-0.5 rounded font-mono">
                            {wl.quota} Quota (Age {wl.age})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: DSA METRICS & DIAGNOSTICS ===================== */}
        {activeTab === "dsa" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Database className="h-5 w-5 text-indigo-400" />
                  <span>Custom DSA Structural Diagnostics</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Live metrics proving custom application implementations (Zero DB indexing/sorting).
                </p>
              </div>
              <button
                onClick={loadDSAMetrics}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl text-indigo-300 transition flex items-center space-x-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh Metrics</span>
              </button>
            </div>

            {dsaMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Hash Table Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="text-sm font-bold text-white">
                      1. Custom PNR Hash Table (Separate Chaining)
                    </h3>
                    <span className="text-[10px] bg-indigo-950 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
                      Polynomial Rolling Hash
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Total Inserted Elements</div>
                      <div className="text-xl font-bold font-mono text-white mt-1">
                        {dsaMetrics.hash_table.size}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Bucket Capacity (M)</div>
                      <div className="text-xl font-bold font-mono text-white mt-1">
                        {dsaMetrics.hash_table.capacity}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Current Load Factor (&alpha;)</div>
                      <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                        {dsaMetrics.hash_table.load_factor}
                      </div>
                      <span className="text-[10px] text-slate-500">Resizes at &ge; 0.75</span>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Total Collisions Handled</div>
                      <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                        {dsaMetrics.hash_table.total_collisions}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dynamic Resizes Executed:</span>
                      <span className="font-mono text-white">
                        {dsaMetrics.hash_table.resizes}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Occupied Buckets:</span>
                      <span className="font-mono text-white">
                        {dsaMetrics.hash_table.occupied_buckets} /{" "}
                        {dsaMetrics.hash_table.capacity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Max Chain Length:</span>
                      <span className="font-mono text-white">
                        {dsaMetrics.hash_table.max_chain_length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bloom Filter Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="text-sm font-bold text-white">
                      2. Probabilistic Bloom Filter Pre-Checker
                    </h3>
                    <span className="text-[10px] bg-indigo-950 border border-indigo-800 text-indigo-300 px-2 py-0.5 rounded font-mono">
                      Kirsch-Mitzenmacher
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Bit Array Size (m)</div>
                      <div className="text-xl font-bold font-mono text-white mt-1">
                        {dsaMetrics.bloom_filter.bit_array_size_m}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Hash Functions (k)</div>
                      <div className="text-xl font-bold font-mono text-white mt-1">
                        {dsaMetrics.bloom_filter.hash_functions_k}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Bits Currently Set</div>
                      <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                        {dsaMetrics.bloom_filter.bits_set}
                      </div>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="text-slate-400 text-[11px]">Theoretical False Pos Rate</div>
                      <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
                        {dsaMetrics.bloom_filter.theoretical_fp_rate}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                    <div className="text-slate-400 mb-1">
                      Mathematical Guarantee:{" "}
                      <span className="text-emerald-400 font-semibold">Zero False Negatives</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Formula: p &approx; (1 - e^(-kn/m))^k. If Bloom Filter returns negative,
                      PNR is guaranteed absent and lookup completes in O(k) time.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Modern Toast Stack */}
      <div className="fixed top-5 right-5 z-[999] flex flex-col space-y-2.5 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-2xl p-4 shadow-2xl backdrop-blur-xl border flex items-start space-x-3 transition-all transform duration-300 ${
              t.type === "success"
                ? "bg-slate-900/95 border-emerald-500/80 text-emerald-200 shadow-emerald-950/50"
                : t.type === "error"
                ? "bg-slate-900/95 border-rose-500/80 text-rose-200 shadow-rose-950/50"
                : t.type === "warning"
                ? "bg-slate-900/95 border-amber-500/80 text-amber-200 shadow-amber-950/50"
                : "bg-slate-900/95 border-indigo-500/80 text-indigo-200 shadow-indigo-950/50"
            }`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {t.type === "success" && <CheckCircle className="h-5 w-5 text-emerald-400" />}
              {t.type === "error" && <AlertTriangle className="h-5 w-5 text-rose-400" />}
              {t.type === "warning" && <Clock className="h-5 w-5 text-amber-400" />}
              {t.type === "info" && <Info className="h-5 w-5 text-indigo-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white tracking-wide">{t.title}</h4>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
              className="text-slate-400 hover:text-white text-xs font-bold p-1 rounded-lg hover:bg-slate-800 transition"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
