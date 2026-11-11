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
  createTrain,
  deleteTrain,
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
  Plus,
  Lock,
  Sun,
  Moon,
  ArrowRightLeft,
  MapPin,
  Calendar,
  Ticket,
  X,
  SearchX,
} from "lucide-react";

export default function RailwayApp() {
  const [activeTab, setActiveTab] = useState<"search" | "pnr" | "chart" | "dsa" | "admin">("search");
  const [trains, setTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme & User Color Palette Support (#425B9A, #76C0EC, #FFF6DC, #FF95A5)
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const isLight = theme === "light";

  // Train Search & Route Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState("ALL");
  const [searchTo, setSearchTo] = useState("ALL");
  const [copiedPnr, setCopiedPnr] = useState<string | null>(null);

  const copyPnrToClipboard = (pnrText: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(pnrText);
      setCopiedPnr(pnrText);
      notify("success", "PNR Copied!", `PNR ${pnrText} copied to clipboard.`);
      setTimeout(() => setCopiedPnr(null), 2500);
    }
  };

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
  const [passengers, setPassengers] = useState<
    Array<{
      first_name: string;
      middle_name: string;
      last_name: string;
      age: number | "";
      gender: string;
      berth_preference: string;
    }>
  >([
    { first_name: "", middle_name: "", last_name: "", age: 30, gender: "M", berth_preference: "LOWER" },
  ]);
  const [holdResult, setHoldResult] = useState<any>(null);
  const [holdTimeLeft, setHoldTimeLeft] = useState<number>(300);
  const [bookingConfirmed, setBookingConfirmed] = useState<any>(null);

  // Dynamic Route Stations and Filtered Trains
  const sourceStations = React.useMemo(() => {
    const set = new Set<string>();
    trains.forEach((t) => {
      if (t.source_station) set.add(t.source_station);
    });
    return Array.from(set).sort();
  }, [trains]);

  const destinationStations = React.useMemo(() => {
    const set = new Set<string>();
    trains.forEach((t) => {
      if (t.destination_station) set.add(t.destination_station);
    });
    return Array.from(set).sort();
  }, [trains]);

  const filteredTrains = React.useMemo(() => {
    return trains.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = t.train_number?.toLowerCase().includes(q);
        const nameMatch = t.train_name?.toLowerCase().includes(q);
        const srcMatch = t.source_station?.toLowerCase().includes(q);
        const dstMatch = t.destination_station?.toLowerCase().includes(q);
        if (!numMatch && !nameMatch && !srcMatch && !dstMatch) return false;
      }
      if (searchFrom !== "ALL" && !t.source_station?.toLowerCase().includes(searchFrom.toLowerCase())) {
        return false;
      }
      if (searchTo !== "ALL" && !t.destination_station?.toLowerCase().includes(searchTo.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [trains, searchQuery, searchFrom, searchTo]);

  const handleSwapStations = () => {
    const prevFrom = searchFrom;
    const prevTo = searchTo;
    setSearchFrom(prevTo);
    setSearchTo(prevFrom);
  };

  // PNR Search State
  const [pnrQuery, setPnrQuery] = useState("");
  const [pnrResult, setPnrResult] = useState<any>(null);
  const [pnrError, setPnrError] = useState<any>(null);

  // Chart State
  const [chartRunId, setChartRunId] = useState<number>(1);
  const [chartData, setChartData] = useState<any>(null);

  // DSA Metrics State
  const [dsaMetrics, setDsaMetrics] = useState<any>(null);

  // Admin Panel States
  const [adminTrainNumber, setAdminTrainNumber] = useState("");
  const [adminTrainName, setAdminTrainName] = useState("");
  const [adminSource, setAdminSource] = useState("");
  const [adminDestination, setAdminDestination] = useState("");
  const [adminRunDates, setAdminRunDates] = useState("2026-11-12, 2026-11-13, 2026-11-14");
  const [adminCoachPreset, setAdminCoachPreset] = useState("standard");
  const [adminCreating, setAdminCreating] = useState(false);
  const [adminDeletingId, setAdminDeletingId] = useState<number | null>(null);

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
    setPassengers([
      ...passengers,
      { first_name: "", middle_name: "", last_name: "", age: 28, gender: "M", berth_preference: "LOWER" },
    ]);
  };

  const handleRemovePassenger = (idx: number) => {
    if (passengers.length === 1) return;
    setPassengers(passengers.filter((_, i) => i !== idx));
  };

  const handlePassengerChange = (index: number, field: string, value: any) => {
    const updated = [...passengers];
    if (field === "age") {
      if (value === "" || value === null || value === undefined) {
        updated[index] = { ...updated[index], age: "" };
      } else {
        const parsed = parseInt(String(value), 10);
        if (isNaN(parsed)) {
          updated[index] = { ...updated[index], age: "" };
        } else {
          // Real-world human age boundary: 1 to 120
          const clamped = Math.max(1, Math.min(120, parsed));
          updated[index] = { ...updated[index], age: clamped };
        }
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setPassengers(updated);
  };

  const handleHoldBooking = async () => {
    if (!selectedRunId) {
      const msg = "Please select a train and scheduled date first.";
      setError(msg);
      notify("warning", "No Schedule Selected", msg);
      return;
    }
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.first_name.trim()) {
        const msg = `Please enter First Name for Passenger #${i + 1}.`;
        setError(msg);
        notify("warning", "Missing Name", msg);
        return;
      }
      if (!p.last_name.trim()) {
        const msg = `Please enter Last Name for Passenger #${i + 1}.`;
        setError(msg);
        notify("warning", "Missing Name", msg);
        return;
      }
      const ageNum = Number(p.age);
      if (p.age === "" || isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        const msg = `Passenger #${i + 1}: Age must be a real-world human age between 1 and 120 years.`;
        setError(msg);
        notify("warning", "Invalid Age", msg);
        return;
      }
    }
    setError(null);
    setLoading(true);
    try {
      const formattedPassengers = passengers.map((p) => {
        const fullName = [p.first_name.trim(), p.middle_name.trim(), p.last_name.trim()]
          .filter(Boolean)
          .join(" ");
        return {
          name: fullName,
          first_name: p.first_name.trim(),
          middle_name: p.middle_name.trim(),
          last_name: p.last_name.trim(),
          age: Number(p.age),
          gender: p.gender,
          berth_preference: p.berth_preference,
        };
      });

      const res = await createBookingHold({
        train_run_id: selectedRunId,
        quota,
        passengers: formattedPassengers,
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

  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminTrainNumber.trim() || !adminTrainName.trim()) {
      notify("warning", "Missing Information", "Please enter train number and name.");
      return;
    }
    const dates = adminRunDates.split(",").map((d) => d.trim()).filter(Boolean);
    if (dates.length === 0) {
      notify("warning", "Missing Dates", "Please enter at least one run date (YYYY-MM-DD).");
      return;
    }

    let coaches = [
      { coach_code: "A1", coach_type: "2AC", total_berths: 8 },
      { coach_code: "B1", coach_type: "3AC", total_berths: 12 },
      { coach_code: "S1", coach_type: "SL", total_berths: 16 },
    ];
    if (adminCoachPreset === "high_cap") {
      coaches = [
        { coach_code: "A1", coach_type: "2AC", total_berths: 12 },
        { coach_code: "B1", coach_type: "3AC", total_berths: 16 },
        { coach_code: "B2", coach_type: "3AC", total_berths: 16 },
        { coach_code: "S1", coach_type: "SL", total_berths: 24 },
      ];
    } else if (adminCoachPreset === "compact") {
      coaches = [
        { coach_code: "A1", coach_type: "2AC", total_berths: 8 },
        { coach_code: "S1", coach_type: "SL", total_berths: 16 },
      ];
    }

    setAdminCreating(true);
    try {
      const res = await createTrain({
        train_number: adminTrainNumber.trim(),
        train_name: adminTrainName.trim(),
        source_station: adminSource.trim() || "New Delhi (NDLS)",
        destination_station: adminDestination.trim() || "Howrah (HWH)",
        run_dates: dates,
        coaches,
      });
      notify(
        "success",
        "Train Created!",
        `Train ${res.train_number} - ${res.train_name} provisioned with ${res.runs_created} scheduled runs.`
      );
      setAdminTrainNumber("");
      setAdminTrainName("");
      setAdminSource("");
      setAdminDestination("");
      await loadTrains();
    } catch (err: any) {
      notify("error", "Creation Failed", err.message || "Failed to create train.");
    } finally {
      setAdminCreating(false);
    }
  };

  const handleDeleteTrain = async (trainId: number, trainNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete train ${trainNumber} and all its runs?`)) {
      return;
    }
    setAdminDeletingId(trainId);
    try {
      await deleteTrain(trainId);
      notify("info", "Train Deleted", `Train ${trainNumber} has been removed.`);
      await loadTrains();
    } catch (err: any) {
      notify("error", "Deletion Failed", err.message || "Failed to delete train.");
    } finally {
      setAdminDeletingId(null);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isLight ? "bg-[#FFF6DC] text-[#425B9A]" : "bg-slate-950 text-slate-100"
      }`}
    >
      {/* Top Header */}
      <header
        className={`sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b transition-colors ${
          isLight
            ? "bg-[#425B9A] text-white border-[#76C0EC]/30 shadow-md"
            : "bg-slate-900/90 text-white border-slate-800 backdrop-blur"
        }`}
      >
        <div className="flex items-center space-x-3">
          <img
            src="/icon.svg"
            alt="RailDSA Engine Logo"
            className="h-11 w-11 rounded-xl shadow-lg hover:scale-105 transition-transform cursor-pointer bg-white/10 p-1"
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight">RailDSA Engine</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF95A5] text-[#425B9A] uppercase tracking-wider">
                Kolkata Hub
              </span>
            </div>
            <p className="text-xs text-[#76C0EC] font-medium tracking-wide">
              Eastern Railway In-Memory Hash/Heap Academic Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs & Theme Toggle */}
        <div className="flex items-center space-x-2">
          <nav
            className={`flex space-x-1 p-1 rounded-xl border ${
              isLight ? "bg-[#334677] border-[#76C0EC]/30" : "bg-slate-800/80 border-slate-700/60"
            }`}
          >
            <button
              onClick={() => setActiveTab("search")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "search"
                  ? isLight
                    ? "bg-[#76C0EC] text-[#425B9A] shadow"
                    : "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Train className="h-4 w-4" />
              <span>Search & Book</span>
            </button>
            <button
              onClick={() => setActiveTab("pnr")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "pnr"
                  ? isLight
                    ? "bg-[#76C0EC] text-[#425B9A] shadow"
                    : "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "chart"
                  ? isLight
                    ? "bg-[#76C0EC] text-[#425B9A] shadow"
                    : "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
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
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "dsa"
                  ? isLight
                    ? "bg-[#76C0EC] text-[#425B9A] shadow"
                    : "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <Database className="h-4 w-4" />
              <span>DSA Diagnostics</span>
            </button>
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer ${
                activeTab === "admin"
                  ? isLight
                    ? "bg-[#76C0EC] text-[#425B9A] shadow"
                    : "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin Portal</span>
            </button>
          </nav>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className={`p-2 rounded-xl border flex items-center space-x-1.5 text-xs font-bold transition cursor-pointer ${
              isLight
                ? "bg-[#76C0EC] border-[#76C0EC] text-[#425B9A] hover:bg-[#68aed8]"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:text-white"
            }`}
            title="Switch Theme (Light: Bengal Heritage #FFF6DC / #425B9A / #76C0EC / #FF95A5)"
          >
            {isLight ? (
              <>
                <Moon className="h-4 w-4 text-[#425B9A]" />
                <span className="hidden md:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="hidden md:inline">Light</span>
              </>
            )}
          </button>
        </div>
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
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ===================== TAB 1: SEARCH & BOOK ===================== */}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Dominant Hero Train & Route Search Console */}
            <div
              className={`rounded-3xl p-6 border shadow-xl transition-all ${
                isLight
                  ? "bg-white border-[#76C0EC]/50 shadow-[#425B9A]/5 text-[#425B9A]"
                  : "bg-slate-900 border-slate-800 text-white"
              }`}
            >
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-5 border-b border-dashed border-slate-700/30">
                <div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                        isLight
                          ? "bg-[#FF95A5] text-[#425B9A]"
                          : "bg-indigo-600 text-white"
                      }`}
                    >
                      Eastern Railway &bull; Kolkata Hub
                    </span>
                    <span className="text-xs font-bold text-emerald-500 flex items-center space-x-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>100% Berths Available &amp; Zero Dummy Data</span>
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight mt-1.5">
                    Kolkata &amp; West Bengal Train Reservation
                  </h2>
                  <p className="text-xs opacity-80 mt-0.5">
                    Fast-path booking powered by Custom Polynomial Hash Table &amp; Min-Heap Priority Queue
                  </p>
                </div>

                {/* Route & Search Controls */}
                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                  {/* Real-time Train Search Input */}
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#76C0EC]" />
                    <input
                      type="text"
                      placeholder="Search train (e.g. 12301, Rajdhani, Puri)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-7 py-2 text-xs font-semibold rounded-xl border outline-none transition ${
                        isLight
                          ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A] placeholder-[#425B9A]/60 focus:ring-2 focus:ring-[#76C0EC]"
                          : "bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-indigo-500"
                      }`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold opacity-60 hover:opacity-100 p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold">From:</span>
                    <select
                      value={searchFrom}
                      onChange={(e) => setSearchFrom(e.target.value)}
                      className={`text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer ${
                        isLight
                          ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                          : "bg-slate-950 border-slate-800 text-white"
                      }`}
                    >
                      <option value="ALL">All Origins</option>
                      {sourceStations.map((stn) => (
                        <option key={stn} value={stn}>
                          {stn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleSwapStations}
                    className={`p-2 rounded-xl border transition cursor-pointer ${
                      isLight
                        ? "bg-[#76C0EC]/20 border-[#76C0EC] hover:bg-[#76C0EC]/40 text-[#425B9A]"
                        : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-white"
                    }`}
                    title="Swap route stations"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </button>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold">To:</span>
                    <select
                      value={searchTo}
                      onChange={(e) => setSearchTo(e.target.value)}
                      className={`text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer ${
                        isLight
                          ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                          : "bg-slate-950 border-slate-800 text-white"
                      }`}
                    >
                      <option value="ALL">All Destinations</option>
                      {destinationStations.map((stn) => (
                        <option key={stn} value={stn}>
                          {stn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(searchQuery || searchFrom !== "ALL" || searchTo !== "ALL") && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchFrom("ALL");
                        setSearchTo("ALL");
                      }}
                      className={`px-2.5 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                        isLight
                          ? "bg-[#FF95A5]/20 text-[#425B9A] border-[#FF95A5] hover:bg-[#FF95A5]/30"
                          : "bg-rose-950/40 text-rose-300 border-rose-800 hover:bg-rose-900/40"
                      }`}
                      title="Clear all filters"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reset</span>
                    </button>
                  )}

                  <button
                    onClick={loadTrains}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                      isLight
                        ? "bg-[#425B9A] text-white border-[#425B9A] hover:bg-[#34487b]"
                        : "bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500"
                    }`}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Quota Strip */}
              <div className="pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                <span className="text-xs font-extrabold uppercase tracking-wider flex items-center space-x-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#76C0EC]" />
                  <span>Quota Prioritization:</span>
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
                  {[
                    { id: "GN", name: "General (GN)", sub: "Standard FCFS" },
                    { id: "SS", name: "Senior Citizen (SS)", sub: "Priority 1 Min-Heap" },
                    { id: "LD", name: "Ladies Quota (LD)", sub: "Priority 2 Min-Heap" },
                    { id: "TQ", name: "Tatkal (TQ)", sub: "Fast Waitlist Pool" },
                  ].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setQuota(q.id)}
                      className={`px-3.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                        quota === q.id
                          ? isLight
                            ? "bg-[#425B9A] border-[#425B9A] text-white shadow-md ring-2 ring-[#76C0EC]/50"
                            : "bg-indigo-600 border-indigo-500 text-white shadow-md"
                          : isLight
                          ? "bg-[#FFF6DC] border-[#76C0EC]/50 text-[#425B9A] hover:bg-[#76C0EC]/20"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <div className="font-extrabold text-xs">{q.name}</div>
                      <div className="text-[10px] opacity-80">{q.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Split Grid: Left Trains List, Right Coach & Passenger Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 5 Cols: West Bengal Trains */}
              <div className="lg:col-span-5 space-y-4">
                <div
                  className={`rounded-2xl p-5 border shadow-xl transition-all ${
                    isLight
                      ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                      : "bg-slate-900 border-slate-800 text-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3.5">
                    <h2 className="text-base font-extrabold flex items-center space-x-2">
                      <Train className="h-4 w-4 text-[#76C0EC]" />
                      <span>Select Train &amp; Schedule</span>
                    </h2>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#76C0EC]/20 text-[#425B9A]">
                      {filteredTrains.length} / {trains.length} Trains
                    </span>
                  </div>

                  {/* Quick Category Filters */}
                  <div className="flex flex-wrap gap-1.5 mb-3.5 pb-2.5 border-b border-dashed border-slate-700/20">
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchFrom("ALL");
                        setSearchTo("ALL");
                      }}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        !searchQuery && searchFrom === "ALL" && searchTo === "ALL"
                          ? isLight
                            ? "bg-[#425B9A] text-white border-[#425B9A]"
                            : "bg-indigo-600 text-white border-indigo-500"
                          : isLight
                          ? "bg-[#FFF6DC] text-[#425B9A] border-[#76C0EC]/40 hover:bg-[#76C0EC]/20"
                          : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      All ({trains.length})
                    </button>
                    {["Rajdhani", "Vande Bharat", "Shatabdi", "Puri"].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSearchQuery(tag)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          searchQuery.toLowerCase() === tag.toLowerCase()
                            ? isLight
                              ? "bg-[#425B9A] text-white border-[#425B9A]"
                              : "bg-indigo-600 text-white border-indigo-500"
                            : isLight
                            ? "bg-[#FFF6DC] text-[#425B9A] border-[#76C0EC]/40 hover:bg-[#76C0EC]/20"
                            : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {/* Empty Filter State or Filtered Train Cards */}
                  {filteredTrains.length === 0 ? (
                    <div
                      className={`p-6 rounded-2xl border text-center space-y-3 ${
                        isLight
                          ? "bg-[#FFF6DC]/50 border-[#76C0EC]/60 text-[#425B9A]"
                          : "bg-slate-950 border-slate-800 text-slate-300"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-[#76C0EC]/20 text-[#425B9A]">
                        <SearchX className="h-6 w-6 text-[#425B9A]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold">No Trains Match Filter</h3>
                        <p className="text-xs opacity-75 mt-1">
                          {searchQuery
                            ? `No trains found matching "${searchQuery}".`
                            : `No trains operate directly between ${searchFrom} and ${searchTo}.`}
                        </p>
                      </div>
                      <div className="pt-2 flex flex-wrap justify-center gap-2">
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            setSearchFrom("ALL");
                            setSearchTo("ALL");
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                            isLight
                              ? "bg-[#425B9A] text-white hover:bg-[#34487b] border-[#425B9A]"
                              : "bg-indigo-600 text-white hover:bg-indigo-500 border-indigo-500"
                          }`}
                        >
                          Show All Trains ({trains.length})
                        </button>
                        <button
                          onClick={loadTrains}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            isLight
                              ? "bg-white border-[#76C0EC] text-[#425B9A] hover:bg-[#76C0EC]/20"
                              : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                          }`}
                        >
                          Reload Fleet
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTrains.map((t) => {
                        const isSelectedTrain = selectedTrain?.id === t.id;
                        return (
                          <div
                            key={t.id}
                            className={`rounded-xl p-3.5 border transition-all ${
                              isSelectedTrain
                                ? isLight
                                  ? "bg-[#FFF6DC]/70 border-2 border-[#425B9A] shadow-md ring-2 ring-[#76C0EC]/30"
                                  : "bg-indigo-950/40 border-2 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
                                : isLight
                                ? "bg-white border-[#76C0EC]/40 hover:border-[#425B9A]/60 shadow-sm"
                                : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-lg ${
                                      isLight
                                        ? "bg-[#425B9A] text-white"
                                        : "bg-indigo-950 text-indigo-300 border border-indigo-800"
                                    }`}
                                  >
                                    {t.train_number}
                                  </span>
                                  <span className="font-extrabold text-sm">{t.train_name}</span>
                                </div>
                                <div className="flex items-center space-x-2 text-xs opacity-80 mt-1 font-medium">
                                  <MapPin className="h-3 w-3 text-[#76C0EC]" />
                                  <span>{t.source_station}</span>
                                  <span>&rarr;</span>
                                  <span>{t.destination_station}</span>
                                </div>
                              </div>
                            </div>

                            {/* Scheduled Runs */}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {t.runs.map((r: any) => {
                                const isSelectedRun = selectedRunId === r.run_id;
                                return (
                                  <button
                                    key={r.run_id}
                                    onClick={() => handleRunSelect(t, r)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 cursor-pointer ${
                                      isSelectedRun
                                        ? isLight
                                          ? "bg-[#425B9A] text-white border-[#425B9A] shadow-sm"
                                          : "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                                        : isLight
                                        ? "bg-white border-[#76C0EC]/50 text-[#425B9A] hover:bg-[#76C0EC]/20"
                                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                                    }`}
                                  >
                                    <span>{r.run_date}</span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                                        r.available_berths > 0
                                          ? isLight
                                            ? "bg-[#76C0EC]/30 text-[#425B9A]"
                                            : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                          : isLight
                                          ? "bg-[#FF95A5] text-white"
                                          : "bg-amber-950 text-amber-400 border border-amber-800"
                                      }`}
                                    >
                                      {r.available_berths > 0
                                        ? `AVL ${r.available_berths}`
                                        : "WL"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right 7 Cols: Live Coach Layout & Passenger Details */}
              <div className="lg:col-span-7 space-y-5">
                {/* Live Coach Berth Layout Map */}
                {coachLayout && (
                  <div
                    className={`rounded-2xl p-5 border shadow-xl transition-all ${
                      isLight
                        ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                        : "bg-slate-900 border-slate-800 text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed border-slate-700/30">
                      <div>
                        <h2 className="text-sm font-extrabold">
                          Live Coach Layout: {coachLayout.train_name} ({coachLayout.train_number})
                        </h2>
                        <span className="text-xs opacity-75">Date: {coachLayout.run_date}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
                        In-Memory Grid
                      </span>
                    </div>

                    <div className="space-y-4">
                      {coachLayout.coaches.map((c: any) => (
                        <div
                          key={c.coach_code}
                          className={`rounded-xl p-3 border ${
                            isLight
                              ? "bg-[#FFF6DC]/40 border-[#76C0EC]/40"
                              : "bg-slate-950/60 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black">
                              Coach {c.coach_code} ({c.coach_type})
                            </span>
                            <span className="text-[10px] opacity-75 font-semibold">
                              Total Berths: {c.total_berths}
                            </span>
                          </div>
                          {/* Berths Grid */}
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                            {c.berths.map((b: any) => {
                              let badgeBg = isLight
                                ? "bg-white text-[#425B9A] border-[#76C0EC]/60 hover:border-[#425B9A]"
                                : "bg-emerald-950/60 border-emerald-800 text-emerald-300";

                              if (b.status === "HELD")
                                badgeBg = isLight
                                  ? "bg-[#FF95A5]/30 border-[#FF95A5] text-[#425B9A] font-bold"
                                  : "bg-amber-950/60 border-amber-800 text-amber-300";
                              else if (b.status === "CONFIRMED")
                                badgeBg = isLight
                                  ? "bg-[#425B9A] text-white border-[#425B9A]"
                                  : "bg-rose-950/60 border-rose-800 text-rose-300";

                              return (
                                <div
                                  key={b.id}
                                  className={`border rounded-lg p-1.5 text-center transition ${badgeBg}`}
                                >
                                  <div className="text-[11px] font-black">{b.berth_number}</div>
                                  <div className="text-[9px] opacity-80 font-bold">{b.berth_type[0]}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center space-x-4 mt-3 text-[11px] pt-2 border-t border-dashed border-slate-700/30">
                      <span className="flex items-center space-x-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        <span className="font-semibold">Available</span>
                      </span>
                      <span className="flex items-center space-x-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#FF95A5]"></span>
                        <span className="font-semibold">Held (5m TTL)</span>
                      </span>
                      <span className="flex items-center space-x-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#425B9A]"></span>
                        <span className="font-semibold">Confirmed</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Passenger Booking Entry (MakeMyTrip / ConfirmTkt Style) */}
                {!holdResult && !bookingConfirmed && (
                  <div
                    className={`rounded-2xl p-6 border shadow-xl space-y-5 transition-all ${
                      isLight
                        ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                        : "bg-slate-900 border-slate-800 text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-4 border-b border-dashed border-slate-700/30">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            isLight
                              ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                              : "bg-indigo-950/80 border-indigo-700 text-indigo-400"
                          }`}
                        >
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-extrabold tracking-wide">
                              Passenger Details
                            </h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                isLight
                                  ? "bg-[#FF95A5] text-[#425B9A]"
                                  : "bg-indigo-950 text-indigo-300 border border-indigo-800"
                              }`}
                            >
                              Quota: {quota}
                            </span>
                          </div>
                          <p className="text-xs opacity-75 mt-0.5 font-medium">
                            Authorized IRCTC-grade reservation format (Max 4 per PNR)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleAddPassenger}
                        disabled={passengers.length >= 4}
                        className={`px-3.5 py-2 border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
                          isLight
                            ? "bg-[#76C0EC]/20 hover:bg-[#76C0EC]/40 border-[#76C0EC] text-[#425B9A]"
                            : "bg-indigo-600/20 hover:bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
                        }`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Add Passenger ({passengers.length}/4)</span>
                      </button>
                    </div>

                    {/* Passenger Cards */}
                    <div className="space-y-3.5">
                      {passengers.map((p, idx) => {
                        const ageNum = typeof p.age === "number" ? p.age : parseInt(String(p.age), 10) || 0;
                        const isSenior = ageNum >= 60 && ageNum <= 120;
                        const isChild = ageNum >= 5 && ageNum < 12;
                        const isInfant = ageNum >= 1 && ageNum < 5;

                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border transition-all space-y-3 shadow-sm ${
                              isLight
                                ? "bg-[#FFF6DC]/40 border-[#76C0EC]/50 hover:border-[#425B9A]"
                                : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2.5">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                    isLight
                                      ? "bg-[#425B9A] text-white"
                                      : "bg-indigo-950 text-indigo-300 border border-indigo-600"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-extrabold">
                                  {idx === 0 ? "Primary Passenger" : `Passenger #${idx + 1}`}
                                </span>
                                {isSenior && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-600 border border-emerald-500/40 flex items-center space-x-1">
                                    <span>🧓 Senior Citizen (SS Quota Priority)</span>
                                  </span>
                                )}
                                {isChild && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-sky-500/20 text-sky-600 border border-sky-500/40">
                                    🧒 Child (5-11 yrs)
                                  </span>
                                )}
                                {isInfant && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-600 border border-amber-500/40">
                                    🍼 Infant (Lap / Under 5)
                                  </span>
                                )}
                                {p.gender === "F" && quota === "LD" && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-600 border border-purple-500/40">
                                    Ladies Quota Applied
                                  </span>
                                )}
                              </div>
                              {passengers.length > 1 && (
                                <button
                                  onClick={() => handleRemovePassenger(idx)}
                                  className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-100/50 transition text-xs flex items-center space-x-1 cursor-pointer"
                                  title="Remove passenger"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span className="text-[11px] font-bold">Remove</span>
                                </button>
                              )}
                            </div>

                            {/* Row 1: Name Breakdown (First, Middle, Last) */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
                              {/* First Name */}
                              <div className="sm:col-span-4">
                                <label className="block text-[11px] font-bold mb-1 opacity-80">
                                  First Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Sourav"
                                  value={p.first_name}
                                  onChange={(e) => handlePassengerChange(idx, "first_name", e.target.value)}
                                  className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition outline-none border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A] focus:border-[#425B9A]"
                                      : "bg-slate-900 border-slate-800 text-white focus:border-indigo-500"
                                  }`}
                                />
                              </div>

                              {/* Middle Name */}
                              <div className="sm:col-span-4">
                                <label className="block text-[11px] font-bold mb-1 opacity-80">
                                  Middle Name <span className="text-[10px] font-normal opacity-70">(Optional)</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Chandidas"
                                  value={p.middle_name}
                                  onChange={(e) => handlePassengerChange(idx, "middle_name", e.target.value)}
                                  className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition outline-none border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A] focus:border-[#425B9A]"
                                      : "bg-slate-900 border-slate-800 text-white focus:border-indigo-500"
                                  }`}
                                />
                              </div>

                              {/* Last Name */}
                              <div className="sm:col-span-4">
                                <label className="block text-[11px] font-bold mb-1 opacity-80">
                                  Last Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. Ganguly"
                                  value={p.last_name}
                                  onChange={(e) => handlePassengerChange(idx, "last_name", e.target.value)}
                                  className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition outline-none border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A] focus:border-[#425B9A]"
                                      : "bg-slate-900 border-slate-800 text-white focus:border-indigo-500"
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Row 2: Age, Gender, Berth Preference */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                              {/* Age with Real-World Human Limit */}
                              <div className="sm:col-span-3">
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[11px] font-bold opacity-80">
                                    Age <span className="text-[10px] font-normal opacity-70">(1-120 yrs)</span> <span className="text-rose-500">*</span>
                                  </label>
                                </div>
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  step={1}
                                  placeholder="e.g. 30"
                                  value={p.age}
                                  onChange={(e) => handlePassengerChange(idx, "age", e.target.value)}
                                  className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition outline-none font-mono border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A] focus:border-[#425B9A]"
                                      : "bg-slate-900 border-slate-800 text-white focus:border-indigo-500"
                                  }`}
                                />
                              </div>

                              {/* Gender */}
                              <div className="sm:col-span-3">
                                <label className="block text-[11px] font-bold mb-1 opacity-80">
                                  Gender
                                </label>
                                <select
                                  value={p.gender}
                                  onChange={(e) => handlePassengerChange(idx, "gender", e.target.value)}
                                  className={`w-full rounded-xl px-2.5 py-2 text-xs font-bold transition outline-none cursor-pointer border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A]"
                                      : "bg-slate-900 border-slate-800 text-white"
                                  }`}
                                >
                                  <option value="M">Male (M)</option>
                                  <option value="F">Female (F)</option>
                                  <option value="O">Other (Transgender)</option>
                                </select>
                              </div>

                              {/* Berth Preference */}
                              <div className="sm:col-span-6">
                                <label className="block text-[11px] font-bold mb-1 opacity-80">
                                  Berth Preference
                                </label>
                                <select
                                  value={p.berth_preference}
                                  onChange={(e) =>
                                    handlePassengerChange(idx, "berth_preference", e.target.value)
                                  }
                                  className={`w-full rounded-xl px-2.5 py-2 text-xs font-bold transition outline-none cursor-pointer border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A]"
                                      : "bg-slate-900 border-slate-800 text-white"
                                  }`}
                                >
                                  <option value="NO_PREF">No Preference (System Optimal)</option>
                                  <option value="LOWER">Lower Berth (Senior Preferred)</option>
                                  <option value="MIDDLE">Middle Berth</option>
                                  <option value="UPPER">Upper Berth</option>
                                  <option value="SIDE_LOWER">Side Lower (SL)</option>
                                  <option value="SIDE_UPPER">Side Upper (SU)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Summary & Pricing Bar */}
                    <div
                      className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border ${
                        isLight
                          ? "bg-[#FFF6DC] border-[#76C0EC]/60"
                          : "bg-slate-950/80 border-slate-800"
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div>
                          <span className="text-[10px] opacity-75 uppercase tracking-wider block font-bold">
                            Total Fare Summary
                          </span>
                          <div className="text-xl font-black text-emerald-600">
                            ₹{500 * passengers.length}{" "}
                            <span className="text-xs font-semibold opacity-75 text-inherit">
                              ({passengers.length} × ₹500 base)
                            </span>
                          </div>
                        </div>
                        <div className="h-8 w-px bg-slate-700/30 hidden sm:block"></div>
                        <div className="hidden sm:block">
                          <span className="text-[10px] opacity-75 uppercase tracking-wider block font-bold">
                            Queue Policy
                          </span>
                          <span className="text-xs font-bold">
                            {quota === "SS"
                              ? "Priority 1 (Senior Citizen Min-Heap)"
                              : quota === "LD"
                              ? "Priority 2 (Ladies Quota Min-Heap)"
                              : quota === "TQ"
                              ? "Tatkal Dynamic Pool"
                              : "General First-Come First-Served"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleHoldBooking}
                        disabled={loading || !selectedRunId}
                        className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold transition text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-lg ${
                          isLight
                            ? "bg-[#425B9A] hover:bg-[#334677] text-white shadow-[#425B9A]/20"
                            : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white"
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Proceed to Seat Hold (5 Min TTL)</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Temporary Hold Modal / Section with Copy PNR */}
                {holdResult && !bookingConfirmed && (
                  <div
                    className={`rounded-2xl p-6 border-2 shadow-2xl space-y-4 ${
                      isLight
                        ? "bg-white border-[#425B9A] text-[#425B9A]"
                        : "bg-slate-900 border-indigo-500 text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-4 border-b border-dashed border-slate-700/30">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-amber-500 font-extrabold flex items-center space-x-1.5">
                          <Clock className="h-4 w-4 animate-spin" />
                          <span>Seat Hold Active (Status: {holdResult.booking_status})</span>
                        </span>
                        <div className="flex items-center space-x-3 mt-1.5">
                          <h3 className="text-2xl font-mono font-black">
                            PNR: {holdResult.pnr}
                          </h3>
                          <button
                            onClick={() => copyPnrToClipboard(holdResult.pnr)}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                              isLight
                                ? "bg-[#76C0EC]/30 border-[#76C0EC] text-[#425B9A] hover:bg-[#76C0EC]/50"
                                : "bg-indigo-950 border-indigo-700 text-indigo-300 hover:bg-indigo-900"
                            }`}
                            title="Copy PNR to clipboard"
                          >
                            {copiedPnr === holdResult.pnr ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-emerald-500">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy PNR</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-mono font-black text-amber-500">
                          {Math.floor(holdTimeLeft / 60)}:
                          {(holdTimeLeft % 60).toString().padStart(2, "0")}
                        </div>
                        <span className="text-[10px] opacity-75 font-bold uppercase tracking-wider">
                          Time to Complete Payment
                        </span>
                      </div>
                    </div>

                    <div className="py-2 space-y-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide opacity-80">
                        Held Berths / Waiting Allocations:
                      </h4>
                      {holdResult.passengers.map((p: any) => (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold ${
                            isLight
                              ? "bg-[#FFF6DC] border border-[#76C0EC]/40"
                              : "bg-slate-950 border border-slate-800"
                          }`}
                        >
                          <span>{p.name}</span>
                          <span
                            className={`font-mono font-black px-2.5 py-1 rounded text-xs ${
                              p.status === "HELD_CNF"
                                ? isLight
                                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                  : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : isLight
                                ? "bg-[#FF95A5]/30 text-[#425B9A] border border-[#FF95A5]"
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
                    <div className="pt-2 border-t border-dashed border-slate-700/30 flex items-center space-x-3">
                      <button
                        onClick={() => handlePayment(true)}
                        disabled={loading}
                        className={`flex-1 font-bold py-3 rounded-xl transition text-xs flex items-center justify-center space-x-2 cursor-pointer shadow-lg ${
                          isLight
                            ? "bg-[#425B9A] hover:bg-[#334677] text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        <span>Simulate Successful Payment (₹{500 * holdResult.passengers.length})</span>
                      </button>
                      <button
                        onClick={() => handlePayment(false)}
                        disabled={loading}
                        className={`px-4 py-3 rounded-xl font-bold transition text-xs cursor-pointer border ${
                          isLight
                            ? "bg-rose-100 border-rose-300 text-rose-700 hover:bg-rose-200"
                            : "bg-rose-950 hover:bg-rose-900 border-rose-800 text-rose-300"
                        }`}
                      >
                        Simulate Failure
                      </button>
                    </div>
                  </div>
                )}

                {/* Booking Confirmation Card with Copy PNR */}
                {bookingConfirmed && (
                  <div
                    className={`rounded-2xl p-6 border-2 shadow-2xl space-y-4 ${
                      isLight
                        ? "bg-white border-emerald-600 text-[#425B9A]"
                        : "bg-slate-900 border-emerald-500 text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-700/30">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                        <div>
                          <div className="flex items-center space-x-3">
                            <h3 className="text-xl font-black">
                              Booking Finalized! PNR: {bookingConfirmed.pnr}
                            </h3>
                            <button
                              onClick={() => copyPnrToClipboard(bookingConfirmed.pnr)}
                              className={`px-3 py-1 rounded-xl border text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                                isLight
                                  ? "bg-[#76C0EC]/30 border-[#76C0EC] text-[#425B9A]"
                                  : "bg-indigo-950 border-indigo-700 text-indigo-300"
                              }`}
                            >
                              {copiedPnr === bookingConfirmed.pnr ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                  <span className="text-emerald-500">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-emerald-600 font-bold mt-0.5">
                            Indexed in Custom PNR Hash Table &amp; Probabilistic Bloom Filter
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {bookingConfirmed.passengers.map((p: any) => (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl flex items-center justify-between text-xs border ${
                            isLight
                              ? "bg-[#FFF6DC] border-[#76C0EC]/40"
                              : "bg-slate-950 border-slate-800"
                          }`}
                        >
                          <div>
                            <div className="font-bold">{p.name}</div>
                            <div className="text-[10px] opacity-75">
                              Age: {p.age} | Gender: {p.gender}
                            </div>
                          </div>
                          <span
                            className={`font-mono font-extrabold px-3 py-1 rounded text-xs ${
                              p.status === "CNF"
                                ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/40"
                                : "bg-amber-500/20 text-amber-600 border border-amber-500/40"
                            }`}
                          >
                            {p.status === "CNF"
                              ? `Confirmed: ${p.coach_code}-${p.berth_number} (${p.berth_type})`
                              : `Waiting List: WL #${p.wl_number || 1}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: PNR STATUS & LOOKUP ===================== */}
        {activeTab === "pnr" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div
              className={`rounded-2xl p-6 border shadow-xl space-y-4 transition-all ${
                isLight
                  ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                  : "bg-slate-900 border-slate-800 text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight
                      ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                      : "bg-indigo-950/80 border-indigo-800/60 text-indigo-400"
                  }`}
                >
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-wide">
                    Custom PNR Search with Bloom Filter Fast-Rejection
                  </h2>
                  <p className="text-xs opacity-75">
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
                    className={`w-full rounded-xl pl-4 pr-10 py-3 text-sm font-mono tracking-wider transition border outline-none ${
                      isLight
                        ? "bg-[#FFF6DC]/40 border-[#76C0EC] text-[#425B9A] focus:border-[#425B9A]"
                        : "bg-slate-950 border-slate-800 text-white focus:border-indigo-500"
                    }`}
                  />
                  {pnrQuery && (
                    <button
                      onClick={() => setPnrQuery("")}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 text-sm font-bold"
                    >
                      &times;
                    </button>
                  )}
                </div>
                <button
                  onClick={handlePNRLookup}
                  disabled={loading}
                  className={`font-extrabold px-6 py-3 rounded-xl text-sm transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg ${
                    isLight
                      ? "bg-[#425B9A] hover:bg-[#324578] text-white shadow-[#425B9A]/20"
                      : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 text-white"
                  }`}
                >
                  <Search className="h-4 w-4" />
                  <span>Lookup PNR</span>
                </button>
              </div>

              {/* Quick Preset / Demo PNR Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="opacity-75 text-[11px] font-bold flex items-center space-x-1">
                  <Sparkles className="h-3 w-3 text-[#76C0EC]" />
                  <span>Try Demo PNR:</span>
                </span>
                {["9999999999"].map((demoPnr) => (
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
                    className={`px-3 py-1 border rounded-lg font-mono text-[11px] font-bold transition cursor-pointer ${
                      isLight
                        ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A] hover:bg-[#76C0EC]/20"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:text-white"
                    }`}
                  >
                    {demoPnr === "9999999999" ? `${demoPnr} (Non-existent PNR Fast Rejection)` : demoPnr}
                  </button>
                ))}
              </div>
            </div>

            {/* Error or Fast Rejection Result */}
            {pnrError && (
              <div
                className={`border rounded-2xl p-5 ${
                  isLight
                    ? "bg-rose-50 border-rose-300 text-rose-800"
                    : "bg-rose-950/40 border-rose-800/80 text-rose-200"
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <XCircle className="h-6 w-6 text-rose-500" />
                  <span className="font-extrabold text-sm">
                    {pnrError.message || "PNR Not Found in System"}
                  </span>
                </div>
                {pnrError.bloom_filter_pre_check === false && (
                  <div
                    className={`text-xs p-3 rounded-xl border font-mono ${
                      isLight
                        ? "bg-white border-rose-200 text-rose-900"
                        : "bg-slate-950/60 border-rose-900/60 text-slate-200"
                    }`}
                  >
                    <span className="text-indigo-400 font-bold">[Bloom Filter Pre-check]:</span>{" "}
                    Query returned FALSE. Definitively absent from system. Execution bypassed
                    database lookup in O(k) time.
                  </div>
                )}
              </div>
            )}

            {/* Success PNR Result with Copy PNR */}
            {pnrResult && (
              <div
                className={`rounded-2xl p-6 border shadow-xl space-y-4 ${
                  isLight
                    ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                    : "bg-slate-900 border-slate-800 text-white"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-700/30">
                  <div>
                    <span className="text-xs opacity-75 font-bold uppercase tracking-wider">
                      PNR Inquiry Status
                    </span>
                    <div className="flex items-center space-x-3 mt-1">
                      <h3 className="text-2xl font-mono font-black">{pnrResult.pnr}</h3>
                      <button
                        onClick={() => copyPnrToClipboard(pnrResult.pnr)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                          isLight
                            ? "bg-[#76C0EC]/30 border-[#76C0EC] text-[#425B9A]"
                            : "bg-indigo-950 border-indigo-700 text-indigo-300"
                        }`}
                        title="Copy PNR to clipboard"
                      >
                        {copiedPnr === pnrResult.pnr ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy PNR</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      pnrResult.booking_status === "CONFIRMED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : pnrResult.booking_status === "CANCELLED"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {pnrResult.booking_status}
                  </span>
                </div>

                {/* Academic DSA Audit Badge */}
                {pnrResult.dsa_audit && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      isLight
                        ? "bg-[#FFF6DC] border-[#76C0EC]/50 text-[#425B9A]"
                        : "bg-slate-950 border-indigo-950 text-slate-300"
                    }`}
                  >
                    <div className="font-extrabold flex items-center space-x-1.5 text-indigo-500">
                      <ShieldCheck className="h-4 w-4" />
                      <span>DSA Pipeline Verification</span>
                    </div>
                    <div className="text-[11px] grid grid-cols-2 gap-2 pt-1 font-mono font-bold">
                      <div>
                        Bloom Pre-Check:{" "}
                        <span className="text-emerald-600">PASSED (Positive)</span>
                      </div>
                      <div>
                        Hash Table Lookup:{" "}
                        <span className="text-emerald-600">O(1) HIT</span>
                      </div>
                      <div>
                        Hash Table Load Factor:{" "}
                        <span>{pnrResult.dsa_audit.hash_table_metrics.load_factor}</span>
                      </div>
                      <div>
                        Bloom FP Rate:{" "}
                        <span>{pnrResult.dsa_audit.bloom_filter_metrics.theoretical_fp_rate}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Passenger Records */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider opacity-80">
                    Passenger Statuses:
                  </h4>
                  {pnrResult.passengers.map((p: any) => (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                        isLight
                          ? "bg-[#FFF6DC]/50 border-[#76C0EC]/40"
                          : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <div>
                        <div className="font-black text-sm">{p.name}</div>
                        <div className="text-[11px] opacity-75 font-semibold">
                          Age: {p.age} | Quota: {pnrResult.quota}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-extrabold text-xs">
                          {p.status === "CNF"
                            ? `${p.coach_code}-${p.berth_number} (${p.berth_type})`
                            : p.status}
                        </span>
                        {p.status !== "CANCELLED" && (
                          <button
                            onClick={() => handleCancelPassenger(pnrResult.pnr, p.id)}
                            className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1 rounded-lg transition cursor-pointer"
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
            <div
              className={`rounded-2xl p-5 border shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all ${
                isLight
                  ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                  : "bg-slate-900 border-slate-800 text-white"
              }`}
            >
              <div>
                <h2 className="text-lg font-black flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5 text-[#76C0EC]" />
                  <span>Reservation Master Chart (Academic Stable Merge-Sort Order)</span>
                </h2>
                <p className="text-xs opacity-80 mt-1 font-medium">
                  Sorted strictly by:{" "}
                  <code className="font-extrabold text-[#76C0EC]">1. Coach Identifier ASC</code> &rarr;{" "}
                  <code className="font-extrabold text-[#76C0EC]">2. Berth Number ASC</code> in deterministic $\Theta(N \log N)$ time.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <select
                  value={chartRunId}
                  onChange={(e) => handleLoadChart(parseInt(e.target.value))}
                  className={`border rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none cursor-pointer ${
                    isLight
                      ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                      : "bg-slate-950 border-slate-800 text-white"
                  }`}
                >
                  {trains.flatMap((t) =>
                    t.runs.map((r: any) => (
                      <option key={r.run_id} value={r.run_id}>
                        {t.train_number} - {t.train_name} ({r.run_date})
                      </option>
                    ))
                  )}
                </select>
                <button
                  onClick={() => handleLoadChart(chartRunId)}
                  className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    isLight
                      ? "bg-[#425B9A] text-white border-[#425B9A]"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                  }`}
                  title="Reload Chart"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {chartData && (
              <div
                className={`rounded-2xl border shadow-xl overflow-hidden transition-all ${
                  isLight
                    ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                    : "bg-slate-900 border-slate-800 text-white"
                }`}
              >
                <div
                  className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-black gap-2 ${
                    isLight
                      ? "bg-[#FFF6DC] border-[#76C0EC]/40 text-[#425B9A]"
                      : "bg-slate-950/70 border-slate-800 text-slate-300"
                  }`}
                >
                  <span className="text-sm tracking-wide">
                    Train: {chartData.train_name} ({chartData.train_number}) &bull; Run Date:{" "}
                    {chartData.run_date}
                  </span>
                  <span
                    className={`font-mono text-xs px-2.5 py-1 rounded-full font-black ${
                      isLight
                        ? "bg-[#425B9A] text-white"
                        : "bg-indigo-950 text-indigo-300 border border-indigo-800"
                    }`}
                  >
                    {chartData.sorting_algorithm_used}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      className={`font-black border-b uppercase text-[11px] tracking-wider ${
                        isLight
                          ? "bg-[#425B9A] text-white border-[#76C0EC]/50"
                          : "bg-slate-950 text-slate-300 border-slate-800"
                      }`}
                    >
                      <tr>
                        <th className="py-3 px-4 font-black">Coach</th>
                        <th className="py-3 px-4 font-black">Berth No</th>
                        <th className="py-3 px-4 font-black">Type</th>
                        <th className="py-3 px-4 font-black">Status</th>
                        <th className="py-3 px-4 font-black">Passenger Name</th>
                        <th className="py-3 px-4 font-black">Age / Gender</th>
                        <th className="py-3 px-4 font-black">Quota</th>
                      </tr>
                    </thead>
                    <tbody
                      className={`divide-y ${
                        isLight ? "divide-[#76C0EC]/20" : "divide-slate-800/60"
                      }`}
                    >
                      {chartData.sorted_chart.map((row: any, i: number) => (
                        <tr
                          key={i}
                          className={`transition ${
                            row.status === "AVAILABLE"
                              ? isLight
                                ? "hover:bg-[#FFF6DC]/40 opacity-70"
                                : "hover:bg-slate-800/30 opacity-60"
                              : isLight
                              ? "hover:bg-[#76C0EC]/10 font-bold"
                              : "hover:bg-slate-800/50 font-bold"
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded font-black text-xs ${
                                isLight
                                  ? "bg-[#425B9A] text-white"
                                  : "bg-indigo-950 text-indigo-300 border border-indigo-800"
                              }`}
                            >
                              {row.coach_code}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-sm">
                            {row.berth_number}
                          </td>
                          <td className="py-3 px-4 font-bold text-xs uppercase tracking-wide opacity-80">
                            {row.berth_type}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                row.status === "AVAILABLE"
                                  ? isLight
                                    ? "bg-slate-100 text-slate-600 border border-slate-300"
                                    : "bg-slate-800 text-slate-400"
                                  : row.status === "HELD"
                                  ? isLight
                                    ? "bg-[#FF95A5]/30 text-[#425B9A] border border-[#FF95A5]"
                                    : "bg-amber-950 text-amber-300 border border-amber-800"
                                  : isLight
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black text-sm">
                            {row.passenger_name}
                          </td>
                          <td className="py-3 px-4 font-bold text-xs opacity-80">
                            {row.age ? `${row.age} / ${row.gender}` : "-"}
                          </td>
                          <td className="py-3 px-4 font-black text-xs">
                            {row.quota ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  row.quota === "SS"
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : row.quota === "LD"
                                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                                    : "bg-blue-100 text-blue-800 border border-blue-300"
                                }`}
                              >
                                {row.quota}
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Waiting List Priority Queue Table */}
                {chartData.waiting_list && chartData.waiting_list.length > 0 && (
                  <div
                    className={`p-5 border-t ${
                      isLight
                        ? "border-[#76C0EC]/30 bg-[#FFF6DC]/40"
                        : "border-slate-800 bg-slate-950/40"
                    }`}
                  >
                    <h3 className="text-xs font-black uppercase tracking-wider mb-2.5 flex items-center space-x-1.5 text-amber-500">
                      <span>Active Waiting List Heap (Priority Ordered)</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {chartData.waiting_list.map((wl: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                            isLight
                              ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                              : "bg-slate-900 border-slate-800 text-white"
                          }`}
                        >
                          <div>
                            <span className="font-black">Priority #{idx + 1}</span>
                            <div className="text-[11px] font-mono opacity-80">PNR: {wl.pnr}</div>
                          </div>
                          <span className="bg-amber-500/20 text-amber-700 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded font-black">
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

        {/* ===================== TAB 5: ADMIN PORTAL ===================== */}
        {activeTab === "admin" && (
          <div className="space-y-6">
            {/* Admin Header Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-indigo-950 border border-indigo-800 rounded-xl text-indigo-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Train & Fleet Administration Portal
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Create new trains, provision coaches with custom berth configurations, and manage scheduled runs in the academic engine.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={loadTrains}
                  disabled={loading}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-2 transition cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Refresh Fleet ({trains.length} Trains)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 5 Cols: Create New Train Form */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Train className="h-4 w-4 text-indigo-400" />
                      <span>Provision New Train</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Instantiates coaches, runs, and individual berth nodes in SQLite DB
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCreateTrain} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                        Train Number
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 12431"
                        value={adminTrainNumber}
                        onChange={(e) => setAdminTrainNumber(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 transition outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                        Train Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rajdhani Express"
                        value={adminTrainName}
                        onChange={(e) => setAdminTrainName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 transition outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                        Source Station
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Hazrat Nizamuddin (NZM)"
                        value={adminSource}
                        onChange={(e) => setAdminSource(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 transition outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                        Destination Station
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Trivandrum Central (TVC)"
                        value={adminDestination}
                        onChange={(e) => setAdminDestination(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 transition outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Run Dates (Comma-separated YYYY-MM-DD)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="2026-11-12, 2026-11-13, 2026-11-14"
                      value={adminRunDates}
                      onChange={(e) => setAdminRunDates(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 transition outline-none font-mono"
                    />
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-[10px] text-slate-500">Quick Fill:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          const d1 = new Date(today);
                          const d2 = new Date(today);
                          d2.setDate(today.getDate() + 1);
                          const d3 = new Date(today);
                          d3.setDate(today.getDate() + 2);
                          setAdminRunDates(
                            `${d1.toISOString().split("T")[0]}, ${
                              d2.toISOString().split("T")[0]
                            }, ${d3.toISOString().split("T")[0]}`
                          );
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                      >
                        Today + Next 2 Days
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                      Coach Configuration Preset
                    </label>
                    <select
                      value={adminCoachPreset}
                      onChange={(e) => setAdminCoachPreset(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white transition outline-none cursor-pointer"
                    >
                      <option value="standard">
                        Standard Fleet (A1: 2AC 8b, B1: 3AC 12b, S1: SL 16b = 36 Berths)
                      </option>
                      <option value="high_cap">
                        High Capacity (A1: 2AC 12b, B1: 3AC 16b, B2: 3AC 16b, S1: SL 24b = 68 Berths)
                      </option>
                      <option value="compact">Express Shuttle (A1: 2AC 8b, S1: SL 16b = 24 Berths)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={adminCreating}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/20 transition cursor-pointer"
                  >
                    {adminCreating ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Provisioning Train...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Deploy Train to Reservation Engine</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right 7 Cols: Active Fleet List */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                      <Database className="h-4 w-4 text-emerald-400" />
                      <span>Active Train Fleet ({trains.length})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Direct management of trains, runs, and berth inventory
                    </p>
                  </div>
                </div>

                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {trains.map((t) => (
                    <div
                      key={t.id}
                      className="p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl transition space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-indigo-400 text-sm">
                              {t.train_number}
                            </span>
                            <span className="font-bold text-white text-sm">{t.train_name}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {t.source_station} &rarr; {t.destination_station}
                          </p>
                        </div>

                        <button
                          onClick={() => handleDeleteTrain(t.id, t.train_number)}
                          disabled={adminDeletingId === t.id}
                          className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{adminDeletingId === t.id ? "Deleting..." : "Delete"}</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-900">
                        <span className="text-[11px] text-slate-500 mr-1 self-center">Runs:</span>
                        {t.runs.map((r: any) => (
                          <span
                            key={r.run_id}
                            className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-300 flex items-center space-x-1.5"
                          >
                            <span>{r.run_date}</span>
                            <span className="text-emerald-400 font-bold">({r.available_berths} avl)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
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
