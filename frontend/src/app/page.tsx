"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  SlidersHorizontal,
  Layers,
  ArrowUpDown,
} from "lucide-react";

export default function RailwayApp() {
  const [activeTab, setActiveTab] = useState<"search" | "pnr" | "chart" | "dsa" | "admin">("search");
  const [trains, setTrains] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme: Dark Palette (#091540, #1B2CC1, #7692FF, #ABD2FA) & Light Palette (#FFF6DC, #425B9A, #76C0EC, #FF95A5)
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isLight = theme === "light";

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFrom, setSearchFrom] = useState("ALL");
  const [searchTo, setSearchTo] = useState("ALL");
  const [selectedJourneyDate, setSelectedJourneyDate] = useState("ALL");
  const [sortBy, setSortBy] = useState<"time" | "avail">("time");
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [copiedPnr, setCopiedPnr] = useState<string | null>(null);

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

  const copyPnrToClipboard = (pnrText: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(pnrText);
      setCopiedPnr(pnrText);
      notify("success", "PNR Copied!", `PNR ${pnrText} copied to clipboard.`);
      setTimeout(() => setCopiedPnr(null), 2500);
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

  // Dynamic Route Stations
  const sourceStations = useMemo(() => {
    const set = new Set<string>();
    trains.forEach((t) => {
      if (t.source_station) set.add(t.source_station);
    });
    return Array.from(set).sort();
  }, [trains]);

  const destinationStations = useMemo(() => {
    const set = new Set<string>();
    trains.forEach((t) => {
      if (t.destination_station) set.add(t.destination_station);
    });
    return Array.from(set).sort();
  }, [trains]);

  const allRunDates = useMemo(() => {
    const set = new Set<string>();
    trains.forEach((t) => {
      t.runs?.forEach((r: any) => {
        if (r.run_date) set.add(r.run_date);
      });
    });
    return Array.from(set).sort();
  }, [trains]);

  // Filtered & Sorted Trains List
  const filteredTrains = useMemo(() => {
    let list = trains.filter((t) => {
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
      if (selectedJourneyDate !== "ALL") {
        const hasDate = t.runs?.some((r: any) => r.run_date === selectedJourneyDate);
        if (!hasDate) return false;
      }
      return true;
    });

    if (sortBy === "avail") {
      list = [...list].sort((a, b) => {
        const aAvail = a.runs?.[0]?.available_berths || 0;
        const bAvail = b.runs?.[0]?.available_berths || 0;
        return bAvail - aAvail;
      });
    }

    return list;
  }, [trains, searchQuery, searchFrom, searchTo, selectedJourneyDate, sortBy]);

  const handleSwapStations = () => {
    const prevFrom = searchFrom;
    const prevTo = searchTo;
    setSearchFrom(prevTo);
    setSearchTo(prevFrom);
  };

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
          setError("Your 5-minute seat hold expired. Berths released back to pool.");
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
      const msg = "Please select a train and scheduled run date first.";
      setError(msg);
      notify("warning", "No Train Selected", msg);
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
        notify("success", "Payment Confirmed!", `PNR ${res.pnr} ticket is confirmed.`);
      } else {
        notify("error", "Payment Failed", `Payment rejected. Seats released back to pool.`);
      }
    } catch (err: any) {
      setError(err.message || "Payment processing failed");
      notify("error", "Payment Error", err.message || "Payment transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePNRLookup = async () => {
    if (!pnrQuery.trim()) return;
    setLoading(true);
    setPnrError(null);
    setPnrResult(null);
    try {
      const data = await lookupPNR(pnrQuery.trim());
      setPnrResult(data);
      loadDSAMetrics();
      notify("info", "PNR Found", `Retrieved status for PNR ${data.pnr}`);
    } catch (err: any) {
      setPnrError(err.message || "PNR not found");
      notify("warning", "PNR Not Found", err.message || "Fast-rejected by Bloom filter or not in Hash Table.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!pnrResult) return;
    setLoading(true);
    try {
      const res = await cancelBooking({ pnr: pnrResult.pnr });
      setPnrResult(res);
      loadDSAMetrics();
      if (selectedRunId) loadLayout(selectedRunId);
      notify("info", "Reservation Cancelled", `PNR ${res.pnr} cancelled. Priority waiting list promoted.`);
    } catch (err: any) {
      setError(err.message);
      notify("error", "Cancellation Failed", err.message || "Could not cancel booking.");
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
      setError(err.message || "Failed to load reservation chart");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminTrainNumber.trim() || !adminTrainName.trim() || !adminSource.trim() || !adminDestination.trim()) {
      const msg = "Please enter all train details.";
      setError(msg);
      notify("warning", "Incomplete Form", msg);
      return;
    }
    const dates = adminRunDates.split(",").map((d) => d.trim()).filter(Boolean);
    if (dates.length === 0) {
      const msg = "Please specify at least one run date (YYYY-MM-DD).";
      setError(msg);
      notify("warning", "Invalid Dates", msg);
      return;
    }
    setAdminCreating(true);
    setError(null);
    try {
      const coachesPayload = adminCoachPreset === "mini"
        ? [{ coach_code: "A1", coach_type: "2AC", total_berths: 8 }]
        : undefined;

      await createTrain({
        train_number: adminTrainNumber.trim(),
        train_name: adminTrainName.trim(),
        source_station: adminSource.trim(),
        destination_station: adminDestination.trim(),
        run_dates: dates,
        coaches: coachesPayload,
      });
      notify("success", "Train Added Successfully", `${adminTrainName.trim()} (${adminTrainNumber.trim()}) registered in database.`);
      setAdminTrainNumber("");
      setAdminTrainName("");
      setAdminSource("");
      setAdminDestination("");
      await loadTrains();
    } catch (err: any) {
      setError(err.message || "Failed to create train");
      notify("error", "Train Creation Failed", err.message || "Failed to save train to database.");
    } finally {
      setAdminCreating(false);
    }
  };

  const handleDeleteTrain = async (trainId: number, trainNumber: string, trainName: string) => {
    setAdminDeletingId(trainId);
    setError(null);
    try {
      await deleteTrain(trainId);
      notify("info", "Train Removed", `${trainName} (${trainNumber}) deleted along with schedules.`);
      await loadTrains();
    } catch (err: any) {
      setError(err.message || "Failed to delete train");
      notify("error", "Delete Failed", err.message || "Could not delete train.");
    } finally {
      setAdminDeletingId(null);
    }
  };

  // Dynamic Step Index (1: Select Train, 2: Passenger Details, 3: Confirm & Hold)
  const currentStep = bookingConfirmed || holdResult ? 3 : selectedTrain ? 2 : 1;

  // Selected coach class availability
  const currentClassAvailability = useMemo(() => {
    if (!selectedTrain?.runs || !selectedRunId) return 0;
    const currentRun = selectedTrain.runs.find((r: any) => r.run_id === selectedRunId);
    return currentRun?.available_berths || 0;
  }, [selectedTrain, selectedRunId]);

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isLight ? "bg-[#FFF6DC] text-[#425B9A]" : "bg-[#091540] text-slate-100"
      }`}
    >
      {/* ===================== TOP HEADER & NAVIGATION ===================== */}
      <header
        className={`sticky top-0 z-50 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between border-b transition-colors ${
          isLight
            ? "bg-white/95 text-[#425B9A] border-[#76C0EC]/50 shadow-md backdrop-blur-md"
            : "bg-[#091540]/95 text-white border-[#1B2CC1]/40 shadow-xl backdrop-blur-md"
        }`}
      >
        {/* Brand / Logo */}
        <div className="flex items-center space-x-3">
          <img
            src="/icon.svg"
            alt="RailDSA Engine Logo"
            className={`h-10 w-10 rounded-xl p-1 shadow-md transition-transform hover:scale-105 ${
              isLight ? "bg-[#FFF6DC] border border-[#76C0EC]" : "bg-[#1B2CC1]/20 border border-[#7692FF]/40"
            }`}
          />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-tight">RailDSA Engine</h1>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isLight
                    ? "bg-[#FF95A5] text-[#425B9A]"
                    : "bg-[#1B2CC1] text-[#ABD2FA] border border-[#7692FF]/50"
                }`}
              >
                Kolkata Hub
              </span>
            </div>
            <p
              className={`text-[11px] font-medium tracking-wide ${
                isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]/80"
              }`}
            >
              Eastern Railway In-Memory Hash/Heap Academic Engine
            </p>
          </div>
        </div>

        {/* Navigation Tabs & Theme Toggle */}
        <div className="flex items-center space-x-2 mt-2 sm:mt-0">
          <nav
            className={`flex items-center space-x-1 p-1 rounded-xl border ${
              isLight
                ? "bg-[#FFF6DC] border-[#76C0EC]/60"
                : "bg-[#0d1c54] border-[#1B2CC1]/60"
            }`}
          >
            {[
              { id: "search", label: "Search & Book", icon: Train },
              { id: "pnr", label: "PNR Status", icon: Search },
              { id: "chart", label: "Reservation Chart", icon: BarChart3 },
              { id: "dsa", label: "DSA Diagnostics", icon: Database },
              { id: "admin", label: "Admin", icon: ShieldCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (tab.id === "chart" && !chartData && selectedRunId) handleLoadChart(selectedRunId);
                    if (tab.id === "dsa") loadDSAMetrics();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    isActive
                      ? isLight
                        ? "bg-[#425B9A] text-white shadow-md"
                        : "bg-[#1B2CC1] text-white shadow-lg shadow-[#1B2CC1]/40 border border-[#7692FF]/50"
                      : isLight
                      ? "text-[#425B9A]/75 hover:text-[#425B9A] hover:bg-[#76C0EC]/20"
                      : "text-[#ABD2FA]/70 hover:text-white hover:bg-[#1B2CC1]/20"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            className={`p-2 rounded-xl border flex items-center space-x-1.5 text-xs font-bold transition cursor-pointer ${
              isLight
                ? "bg-white border-[#76C0EC] text-[#425B9A] hover:bg-[#76C0EC]/20"
                : "bg-[#0d1c54] border-[#1B2CC1] text-[#ABD2FA] hover:text-white hover:bg-[#1B2CC1]/40"
            }`}
            title="Toggle Light / Dark Theme"
          >
            {isLight ? (
              <>
                <Moon className="h-4 w-4 text-[#425B9A]" />
                <span className="hidden lg:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 text-amber-300" />
                <span className="hidden lg:inline">Light</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-6 py-2.5 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white text-sm">
            &times;
          </button>
        </div>
      )}

      {/* Main Content Max Width Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ===================== TAB 1: SEARCH & BOOK (WIREFRAME REFERENCE) ===================== */}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* 1. Step Progress Bar (Symmetrical 12 Columns) */}
            <div
              className={`rounded-2xl p-4 sm:p-5 border shadow-xl transition-all ${
                isLight
                  ? "bg-white border-[#76C0EC]/50 shadow-sm"
                  : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 shadow-lg shadow-[#091540]"
              }`}
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-4 items-center">
                {/* Step 1 */}
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                      currentStep >= 1
                        ? isLight
                          ? "bg-[#425B9A] text-white ring-2 ring-[#76C0EC]"
                          : "bg-[#1B2CC1] text-white ring-2 ring-[#7692FF]"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    1
                  </div>
                  <div>
                    <div className="text-xs font-black">Select Train</div>
                    <div
                      className={`text-[10px] hidden sm:block ${
                        isLight ? "text-[#425B9A]/70" : "text-[#ABD2FA]/70"
                      }`}
                    >
                      Choose train, date &amp; class
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                      currentStep >= 2
                        ? isLight
                          ? "bg-[#425B9A] text-white ring-2 ring-[#76C0EC]"
                          : "bg-[#1B2CC1] text-white ring-2 ring-[#7692FF]"
                        : isLight
                        ? "bg-slate-200 text-slate-600"
                        : "bg-[#091540] text-slate-400 border border-slate-700"
                    }`}
                  >
                    2
                  </div>
                  <div>
                    <div className="text-xs font-black">Passenger Details</div>
                    <div
                      className={`text-[10px] hidden sm:block ${
                        isLight ? "text-[#425B9A]/70" : "text-[#ABD2FA]/70"
                      }`}
                    >
                      Enter passengers &amp; quota
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 transition-colors ${
                      currentStep >= 3
                        ? isLight
                          ? "bg-[#425B9A] text-white ring-2 ring-[#76C0EC]"
                          : "bg-[#1B2CC1] text-white ring-2 ring-[#7692FF]"
                        : isLight
                        ? "bg-slate-200 text-slate-600"
                        : "bg-[#091540] text-slate-400 border border-slate-700"
                    }`}
                  >
                    3
                  </div>
                  <div>
                    <div className="text-xs font-black">Confirm &amp; Hold</div>
                    <div
                      className={`text-[10px] hidden sm:block ${
                        isLight ? "text-[#425B9A]/70" : "text-[#ABD2FA]/70"
                      }`}
                    >
                      Review, fare &amp; temporary hold
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Symmetrical Search & Filters Bar (12 Columns) */}
            <div
              className={`rounded-2xl p-4 sm:p-5 border shadow-xl transition-all ${
                isLight
                  ? "bg-white border-[#76C0EC]/50 shadow-sm"
                  : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 shadow-lg shadow-[#091540]"
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                {/* From Station (lg: 3 cols) */}
                <div className="lg:col-span-3">
                  <label
                    className={`block text-[11px] font-bold mb-1 flex items-center space-x-1 ${
                      isLight ? "text-[#425B9A]" : "text-[#ABD2FA]"
                    }`}
                  >
                    <Train className="h-3 w-3" />
                    <span>From Origin</span>
                  </label>
                  <select
                    value={searchFrom}
                    onChange={(e) => setSearchFrom(e.target.value)}
                    className={`w-full text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer transition ${
                      isLight
                        ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                        : "bg-[#091540] border-[#1B2CC1] text-white focus:border-[#7692FF]"
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

                {/* Swap Button (lg: 1 col) */}
                <div className="lg:col-span-1 flex justify-center pt-5">
                  <button
                    onClick={handleSwapStations}
                    className={`p-2 rounded-xl border transition cursor-pointer ${
                      isLight
                        ? "bg-[#FFF6DC] border-[#76C0EC] hover:bg-[#76C0EC]/30 text-[#425B9A]"
                        : "bg-[#091540] border-[#1B2CC1] hover:border-[#7692FF] text-[#7692FF]"
                    }`}
                    title="Swap route stations"
                  >
                    <ArrowRightLeft className="h-4 w-4" />
                  </button>
                </div>

                {/* To Station (lg: 3 cols) */}
                <div className="lg:col-span-3">
                  <label
                    className={`block text-[11px] font-bold mb-1 flex items-center space-x-1 ${
                      isLight ? "text-[#425B9A]" : "text-[#ABD2FA]"
                    }`}
                  >
                    <MapPin className="h-3 w-3" />
                    <span>To Destination</span>
                  </label>
                  <select
                    value={searchTo}
                    onChange={(e) => setSearchTo(e.target.value)}
                    className={`w-full text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer transition ${
                      isLight
                        ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                        : "bg-[#091540] border-[#1B2CC1] text-white focus:border-[#7692FF]"
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

                {/* Journey Date (lg: 2 cols) */}
                <div className="lg:col-span-2">
                  <label
                    className={`block text-[11px] font-bold mb-1 flex items-center space-x-1 ${
                      isLight ? "text-[#425B9A]" : "text-[#ABD2FA]"
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    <span>Journey Date</span>
                  </label>
                  <select
                    value={selectedJourneyDate}
                    onChange={(e) => setSelectedJourneyDate(e.target.value)}
                    className={`w-full text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer transition ${
                      isLight
                        ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                        : "bg-[#091540] border-[#1B2CC1] text-white focus:border-[#7692FF]"
                    }`}
                  >
                    <option value="ALL">All Schedule Dates</option>
                    {allRunDates.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Train Search Input + Action Button (lg: 3 cols) */}
                <div className="lg:col-span-3">
                  <label
                    className={`block text-[11px] font-bold mb-1 flex items-center space-x-1 ${
                      isLight ? "text-[#425B9A]" : "text-[#ABD2FA]"
                    }`}
                  >
                    <Search className="h-3 w-3" />
                    <span>Train No. / Name</span>
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder="e.g. 12301, Rajdhani"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-3 pr-7 py-2 text-xs font-semibold rounded-xl border outline-none transition ${
                          isLight
                            ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A] placeholder-[#425B9A]/60"
                            : "bg-[#091540] border-[#1B2CC1] text-white placeholder-slate-400 focus:border-[#7692FF]"
                        }`}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold opacity-60 hover:opacity-100"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                    <button
                      onClick={loadTrains}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 transition cursor-pointer shadow-md ${
                        isLight
                          ? "bg-[#425B9A] text-white hover:bg-[#334677]"
                          : "bg-[#1B2CC1] text-white hover:bg-[#1523a0] border border-[#7692FF]/50"
                      }`}
                    >
                      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">Refresh</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Main Grid (Desktop 12 cols): Left 4 cols (Trains), Right 8 cols (Booking & Details) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* ================= LEFT 4 COLUMNS: AVAILABLE TRAINS ================= */}
              <div className="lg:col-span-4 space-y-4">
                <div
                  className={`rounded-2xl p-4 sm:p-5 border shadow-xl transition-all ${
                    isLight
                      ? "bg-white border-[#76C0EC]/50 shadow-sm"
                      : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 shadow-lg shadow-[#091540]"
                  }`}
                >
                  {/* Header & Sort */}
                  <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-dashed border-slate-700/30">
                    <div className="flex items-center space-x-2">
                      <Train className={`h-4 w-4 ${isLight ? "text-[#425B9A]" : "text-[#7692FF]"}`} />
                      <h2 className="text-sm font-extrabold">Available Trains ({filteredTrains.length})</h2>
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className={`text-[10px] font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer ${
                        isLight
                          ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                          : "bg-[#091540] border-[#1B2CC1] text-[#ABD2FA]"
                      }`}
                    >
                      <option value="time">Sort: Departure Time</option>
                      <option value="avail">Sort: Availability</option>
                    </select>
                  </div>

                  {/* Empty state or Train Cards */}
                  {filteredTrains.length === 0 ? (
                    <div
                      className={`p-6 rounded-2xl border text-center space-y-3 ${
                        isLight
                          ? "bg-[#FFF6DC]/50 border-[#76C0EC]/60 text-[#425B9A]"
                          : "bg-[#091540] border-[#1B2CC1] text-slate-300"
                      }`}
                    >
                      <SearchX className="h-7 w-7 mx-auto opacity-60" />
                      <div>
                        <h4 className="text-xs font-black">No Trains Found</h4>
                        <p className="text-[10px] opacity-75 mt-0.5">
                          {searchQuery
                            ? `No match for "${searchQuery}".`
                            : `No trains operate between ${searchFrom} and ${searchTo}.`}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setSearchFrom("ALL");
                          setSearchTo("ALL");
                          setSelectedJourneyDate("ALL");
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          isLight
                            ? "bg-[#425B9A] text-white hover:bg-[#334677]"
                            : "bg-[#1B2CC1] text-white hover:bg-[#1523a0] border-[#7692FF]/50"
                        }`}
                      >
                        Show All Trains ({trains.length})
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredTrains.map((t) => {
                        const isSelectedTrain = selectedTrain?.id === t.id;
                        const firstRun = t.runs?.[0];
                        const totalAvail = t.runs?.reduce((acc: number, r: any) => acc + (r.available_berths || 0), 0);

                        return (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTrain(t);
                              if (firstRun) {
                                setSelectedRunId(firstRun.run_id);
                                loadLayout(firstRun.run_id);
                              }
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                              isSelectedTrain
                                ? isLight
                                  ? "bg-[#FFF6DC] border-2 border-[#425B9A] shadow-md ring-2 ring-[#76C0EC]/40"
                                  : "bg-[#1B2CC1]/20 border-2 border-[#7692FF] shadow-lg shadow-[#1B2CC1]/30 ring-1 ring-[#7692FF]/50"
                                : isLight
                                ? "bg-white border-[#76C0EC]/40 hover:border-[#425B9A] shadow-sm"
                                : "bg-[#091540]/60 border-[#1B2CC1]/30 hover:border-[#7692FF]/50"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span
                                    className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                                      isLight
                                        ? "bg-[#425B9A] text-white"
                                        : "bg-[#1B2CC1] text-[#ABD2FA] border border-[#7692FF]/40"
                                    }`}
                                  >
                                    {t.train_number}
                                  </span>
                                  <span className="text-xs font-black line-clamp-1">{t.train_name}</span>
                                </div>
                                <div
                                  className={`text-[10px] font-semibold flex items-center space-x-1 ${
                                    isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]/80"
                                  }`}
                                >
                                  <span>{t.source_station}</span>
                                  <span>&rarr;</span>
                                  <span>{t.destination_station}</span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 opacity-60 mt-1 shrink-0" />
                            </div>

                            {/* Run Dates / Avail Bar */}
                            <div className="mt-2.5 pt-2 border-t border-dashed border-slate-700/20 flex flex-wrap items-center justify-between gap-1 text-[10px]">
                              <span className="opacity-75">
                                {firstRun ? `${firstRun.run_date}` : "Scheduled"}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full font-black ${
                                  totalAvail > 0
                                    ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                                }`}
                              >
                                {totalAvail > 0 ? `AVL ${totalAvail}` : "WL Active"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ================= RIGHT 8 COLUMNS: BOOKING & DETAILS ================= */}
              <div className="lg:col-span-8 space-y-5">
                {/* 1. Train Header & Quota & Class & Coach Grid Card */}
                {selectedTrain && (
                  <div
                    className={`rounded-2xl p-5 sm:p-6 border shadow-xl transition-all space-y-4 ${
                      isLight
                        ? "bg-white border-[#76C0EC]/50 shadow-sm"
                        : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 shadow-lg shadow-[#091540]"
                    }`}
                  >
                    {/* Train Title Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-dashed border-slate-700/30 gap-2">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-[#7692FF]"
                          }`}
                        >
                          <Train className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-black">
                            {selectedTrain.train_number} &bull; {selectedTrain.train_name}
                          </h2>
                          <div
                            className={`text-xs font-semibold flex items-center space-x-1 mt-0.5 ${
                              isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]"
                            }`}
                          >
                            <span>{selectedTrain.source_station}</span>
                            <span>&rarr;</span>
                            <span>{selectedTrain.destination_station}</span>
                            <span>&bull;</span>
                            <span>{coachLayout?.run_date || "2026-11-08"}</span>
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 border border-emerald-500/30 self-start sm:self-center">
                        Live (In-Memory)
                      </span>
                    </div>

                    {/* Schedule Run Date Pills */}
                    <div>
                      <div
                        className={`text-[11px] font-bold mb-2 flex items-center space-x-1 ${
                          isLight ? "text-[#425B9A]" : "text-[#ABD2FA]"
                        }`}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Select Scheduled Date:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedTrain.runs?.map((r: any) => {
                          const isRunSelected = selectedRunId === r.run_id;
                          return (
                            <button
                              key={r.run_id}
                              onClick={() => handleRunSelect(selectedTrain, r)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-2 cursor-pointer ${
                                isRunSelected
                                  ? isLight
                                    ? "bg-[#425B9A] text-white border-[#425B9A] shadow-md ring-2 ring-[#76C0EC]/50"
                                    : "bg-[#1B2CC1] text-white border-[#7692FF] shadow-lg shadow-[#1B2CC1]/40 ring-1 ring-[#7692FF]"
                                  : isLight
                                  ? "bg-[#FFF6DC] border-[#76C0EC]/60 text-[#425B9A] hover:bg-[#76C0EC]/20"
                                  : "bg-[#091540] border-[#1B2CC1]/50 text-[#ABD2FA] hover:text-white"
                              }`}
                            >
                              <span>{r.run_date}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                  r.available_berths > 0
                                    ? "bg-emerald-500/30 text-emerald-400"
                                    : "bg-amber-500/30 text-amber-400"
                                }`}
                              >
                                {r.available_berths > 0 ? `AVL ${r.available_berths}` : "WL"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reservation Quota Strip (INSIDE THIS CARD!) */}
                    <div className="pt-3 border-t border-dashed border-slate-700/30">
                      <div
                        className={`text-[11px] font-bold mb-2 flex items-center space-x-1.5 ${
                          isLight ? "text-[#425B9A]" : "text-[#ABD2FA]"
                        }`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 text-[#7692FF]" />
                        <span>Reservation Quota:</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "GN", name: "General (GN)", sub: "Standard FCFS" },
                          { id: "SS", name: "Senior Citizen (SS)", sub: "Priority 1 Min-Heap" },
                          { id: "LD", name: "Ladies Quota (LD)", sub: "Priority 2 Min-Heap" },
                          { id: "TQ", name: "Tatkal (TQ)", sub: "Fast Waitlist Pool" },
                        ].map((q) => (
                          <button
                            key={q.id}
                            onClick={() => setQuota(q.id)}
                            className={`px-3 py-2 rounded-xl border text-left transition cursor-pointer ${
                              quota === q.id
                                ? isLight
                                  ? "bg-[#425B9A] text-white border-[#425B9A] shadow-md ring-2 ring-[#76C0EC]/50"
                                  : "bg-[#1B2CC1] text-white border-[#7692FF] shadow-lg shadow-[#1B2CC1]/40 ring-1 ring-[#7692FF]"
                                : isLight
                                ? "bg-[#FFF6DC] border-[#76C0EC]/50 text-[#425B9A] hover:bg-[#76C0EC]/20"
                                : "bg-[#091540] border-[#1B2CC1]/50 text-[#ABD2FA] hover:text-white"
                            }`}
                          >
                            <div className="font-extrabold text-xs">{q.name}</div>
                            <div className="text-[10px] opacity-75">{q.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Select Class Strip */}
                    <div className="pt-3 border-t border-dashed border-slate-700/30">
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`text-[11px] font-bold flex items-center space-x-1.5 ${
                            isLight ? "text-[#425B9A]" : "text-[#ABD2FA]"
                          }`}
                        >
                          <Layers className="h-3.5 w-3.5 text-[#7692FF]" />
                          <span>Select Travel Class:</span>
                        </div>
                        <span className="text-xs font-black text-emerald-500">
                          {selectedClass === "ALL" ? "Total" : selectedClass} Availability: {currentClassAvailability} berths
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { id: "ALL", name: "All Coaches" },
                          { id: "2AC", name: "AC 2 Tier (2AC)" },
                          { id: "3AC", name: "AC 3 Tier (3AC)" },
                          { id: "SL", name: "Sleeper (SL)" },
                        ].map((cls) => (
                          <button
                            key={cls.id}
                            onClick={() => setSelectedClass(cls.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                              selectedClass === cls.id
                                ? isLight
                                  ? "bg-[#425B9A] text-white border-[#425B9A] shadow-md"
                                  : "bg-[#1B2CC1] text-white border-[#7692FF] shadow-md shadow-[#1B2CC1]/40"
                                : isLight
                                ? "bg-[#FFF6DC] border-[#76C0EC]/50 text-[#425B9A] hover:bg-[#76C0EC]/20"
                                : "bg-[#091540] border-[#1B2CC1]/50 text-[#ABD2FA] hover:text-white"
                            }`}
                          >
                            {cls.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Live Coach Layout Map */}
                    {coachLayout && (
                      <div className="pt-3 border-t border-dashed border-slate-700/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black">Live Coach Layout ({coachLayout.coaches?.length} Coaches)</h4>
                          <span
                            className={`text-[10px] font-semibold ${
                              isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]"
                            }`}
                          >
                            In-Memory Grid Verification
                          </span>
                        </div>

                        <div className="space-y-3">
                          {coachLayout.coaches
                            ?.filter((c: any) => selectedClass === "ALL" || c.coach_type?.includes(selectedClass) || c.coach_code?.includes(selectedClass))
                            .map((c: any) => (
                              <div
                                key={c.coach_code}
                                className={`rounded-xl p-3 border ${
                                  isLight
                                    ? "bg-[#FFF6DC]/50 border-[#76C0EC]/50"
                                    : "bg-[#091540] border-[#1B2CC1]/50"
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-black">
                                    Coach {c.coach_code} ({c.coach_type})
                                  </span>
                                  <span className="text-[10px] font-bold opacity-75">
                                    Total Berths: {c.total_berths}
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                                  {c.berths.map((b: any) => {
                                    let badgeBg = isLight
                                      ? "bg-white text-[#425B9A] border-[#76C0EC]/60 hover:border-[#425B9A]"
                                      : "bg-emerald-950/40 border-emerald-800 text-emerald-300";

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

                        {/* Berth Legend */}
                        <div className="flex items-center space-x-4 pt-1 text-[11px]">
                          <span className="flex items-center space-x-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                            <span className="font-semibold">Available</span>
                          </span>
                          <span className="flex items-center space-x-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                            <span className="font-semibold">Held (5m TTL)</span>
                          </span>
                          <span className="flex items-center space-x-1.5">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${isLight ? "bg-[#425B9A]" : "bg-[#1B2CC1]"}`}
                            ></span>
                            <span className="font-semibold">Confirmed</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Passenger Booking Entry Form (MMT / ConfirmTkt Style) */}
                {!holdResult && !bookingConfirmed && (
                  <div
                    className={`rounded-2xl p-5 sm:p-6 border shadow-xl space-y-5 transition-all ${
                      isLight
                        ? "bg-white border-[#76C0EC]/50 shadow-sm"
                        : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 shadow-lg shadow-[#091540]"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-4 border-b border-dashed border-slate-700/30">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-[#7692FF]"
                          }`}
                        >
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-base font-black">Passenger Details</h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                isLight ? "bg-[#FF95A5] text-[#425B9A]" : "bg-[#1B2CC1] text-[#ABD2FA]"
                              }`}
                            >
                              Quota: {quota}
                            </span>
                          </div>
                          <p
                            className={`text-xs mt-0.5 font-medium ${
                              isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]/80"
                            }`}
                          >
                            Authorized IRCTC reservation format (Max 4 passengers per PNR)
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleAddPassenger}
                        disabled={passengers.length >= 4}
                        className={`px-3.5 py-2 border disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer ${
                          isLight
                            ? "bg-[#FFF6DC] hover:bg-[#76C0EC]/30 border-[#76C0EC] text-[#425B9A]"
                            : "bg-[#091540] hover:bg-[#1B2CC1]/30 border-[#1B2CC1] text-[#ABD2FA]"
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
                                : "bg-[#091540] border-[#1B2CC1]/60 hover:border-[#7692FF]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2.5">
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                    isLight ? "bg-[#425B9A] text-white" : "bg-[#1B2CC1] text-white"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-extrabold">
                                  {idx === 0 ? "Primary Passenger" : `Passenger #${idx + 1}`}
                                </span>
                                {isSenior && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-600 border border-emerald-500/40">
                                    🧓 Senior Citizen (SS Quota Priority)
                                  </span>
                                )}
                                {isChild && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-sky-500/20 text-sky-600 border border-sky-500/40">
                                    🧒 Child (5-11 yrs)
                                  </span>
                                )}
                                {isInfant && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-600 border border-amber-500/40">
                                    🍼 Infant (No Berth Required)
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

                            {/* Row 1: Name Breakdown */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-1">
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
                                      : "bg-[#0d1c54] border-[#1B2CC1] text-white focus:border-[#7692FF]"
                                  }`}
                                />
                              </div>

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
                                      : "bg-[#0d1c54] border-[#1B2CC1] text-white focus:border-[#7692FF]"
                                  }`}
                                />
                              </div>

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
                                      : "bg-[#0d1c54] border-[#1B2CC1] text-white focus:border-[#7692FF]"
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Row 2: Age, Gender, Berth Preference */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                              <div className="sm:col-span-3">
                                <label className="block text-[11px] font-bold mb-1 opacity-80">
                                  Age <span className="text-[10px] font-normal opacity-70">(1-120 yrs)</span> <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  step={1}
                                  placeholder="30"
                                  value={p.age}
                                  onChange={(e) => handlePassengerChange(idx, "age", e.target.value)}
                                  className={`w-full rounded-xl px-3 py-2 text-xs font-bold transition outline-none font-mono border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A] focus:border-[#425B9A]"
                                      : "bg-[#0d1c54] border-[#1B2CC1] text-white focus:border-[#7692FF]"
                                  }`}
                                />
                              </div>

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
                                      : "bg-[#0d1c54] border-[#1B2CC1] text-white"
                                  }`}
                                >
                                  <option value="M">Male (M)</option>
                                  <option value="F">Female (F)</option>
                                  <option value="O">Other (Transgender)</option>
                                </select>
                              </div>

                              <div className="sm:col-span-6">
                                <label className="block text-[11px] font-bold mb-1 opacity-80">
                                  Berth Preference
                                </label>
                                <select
                                  value={p.berth_preference}
                                  onChange={(e) => handlePassengerChange(idx, "berth_preference", e.target.value)}
                                  className={`w-full rounded-xl px-2.5 py-2 text-xs font-bold transition outline-none cursor-pointer border ${
                                    isLight
                                      ? "bg-white border-[#76C0EC] text-[#425B9A]"
                                      : "bg-[#0d1c54] border-[#1B2CC1] text-white"
                                  }`}
                                >
                                  <option value="NO_PREF">No Preference (Optimal Allocation)</option>
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

                    {/* Summary & Proceed Action Bar */}
                    <div
                      className={`p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border ${
                        isLight
                          ? "bg-[#FFF6DC] border-[#76C0EC]/60"
                          : "bg-[#091540] border-[#1B2CC1]/80"
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div>
                          <span className="text-[10px] opacity-75 uppercase tracking-wider block font-bold">
                            Fare Summary
                          </span>
                          <div className="text-xl font-black text-emerald-500">
                            ₹{500 * passengers.length}{" "}
                            <span className="text-xs font-semibold opacity-75 text-inherit">
                              ({passengers.length} × ₹500)
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
                            : "bg-[#1B2CC1] hover:bg-[#1523a0] text-white shadow-lg shadow-[#1B2CC1]/40 border border-[#7692FF]/50"
                        }`}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>Proceed to Seat Hold (5 Min TTL)</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Temporary Hold Modal / Section with Copy PNR */}
                {holdResult && !bookingConfirmed && (
                  <div
                    className={`rounded-2xl p-6 border-2 shadow-2xl space-y-4 ${
                      isLight
                        ? "bg-white border-[#425B9A] text-[#425B9A]"
                        : "bg-[#0d1c54] border-[#7692FF] text-white shadow-lg shadow-[#1B2CC1]/30"
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
                            className={`px-3 py-1 rounded-xl border text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                              isLight
                                ? "bg-[#76C0EC]/30 border-[#76C0EC] text-[#425B9A]"
                                : "bg-[#1B2CC1]/30 border-[#7692FF] text-[#ABD2FA]"
                            }`}
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
                        <span className="text-[10px] opacity-75 uppercase font-bold block">
                          Time to Complete Payment
                        </span>
                        <span className="text-2xl font-mono font-black text-rose-500">
                          {Math.floor(holdTimeLeft / 60)}:
                          {(holdTimeLeft % 60).toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wide opacity-80">
                        Held Berths / Waiting Allocations:
                      </h4>
                      {holdResult.passengers.map((p: any) => (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between p-3 rounded-xl text-xs font-bold ${
                            isLight ? "bg-[#FFF6DC] border border-[#76C0EC]/40" : "bg-[#091540] border border-[#1B2CC1]"
                          }`}
                        >
                          <span>{p.name}</span>
                          <span
                            className={`font-mono font-black px-2.5 py-1 rounded text-xs ${
                              p.status === "HELD_CNF"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
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
                        className="px-4 py-3 rounded-xl font-bold transition text-xs cursor-pointer border bg-rose-950 hover:bg-rose-900 border-rose-800 text-rose-300"
                      >
                        Simulate Failure
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Booking Confirmation Card */}
                {bookingConfirmed && (
                  <div
                    className={`rounded-2xl p-6 border-2 shadow-2xl space-y-4 ${
                      isLight
                        ? "bg-white border-emerald-600 text-[#425B9A]"
                        : "bg-[#0d1c54] border-emerald-500 text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-700/30">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
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
                                  : "bg-[#1B2CC1]/30 border-[#7692FF] text-[#ABD2FA]"
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
                          <p className="text-xs text-emerald-500 font-bold mt-0.5">
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
                            isLight ? "bg-[#FFF6DC] border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
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
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
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
                  : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 text-white shadow-lg shadow-[#091540]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-[#7692FF]"
                  }`}
                >
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Custom PNR Search with Bloom Filter Fast-Rejection</h3>
                  <p
                    className={`text-xs mt-0.5 ${
                      isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]/80"
                    }`}
                  >
                    Demonstrates the probabilistic Bloom filter (O(k)) pre-check: if absent, it rejects immediately without querying the custom hash table or database.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Enter 10-digit PNR Number (e.g. 1234567890)"
                  value={pnrQuery}
                  onChange={(e) => setPnrQuery(e.target.value)}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-mono font-bold tracking-wider outline-none border transition ${
                    isLight
                      ? "bg-white border-[#76C0EC] text-[#425B9A] focus:border-[#425B9A]"
                      : "bg-[#091540] border-[#1B2CC1] text-white focus:border-[#7692FF]"
                  }`}
                />
                <button
                  onClick={handlePNRLookup}
                  disabled={loading || !pnrQuery.trim()}
                  className={`px-6 py-2.5 rounded-xl font-bold transition text-xs flex items-center space-x-1.5 cursor-pointer shadow-md ${
                    isLight
                      ? "bg-[#425B9A] text-white hover:bg-[#334677]"
                      : "bg-[#1B2CC1] text-white hover:bg-[#1523a0] border border-[#7692FF]/50 shadow-md shadow-[#1B2CC1]/40"
                  }`}
                >
                  <Search className="h-4 w-4" />
                  <span>Lookup PNR</span>
                </button>
              </div>

              {pnrError && (
                <div className="p-4 rounded-xl border bg-rose-950/40 border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{pnrError}</span>
                </div>
              )}
            </div>

            {pnrResult && (
              <div
                className={`rounded-2xl p-6 border shadow-xl space-y-4 transition-all ${
                  isLight
                    ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                    : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 text-white shadow-lg shadow-[#091540]"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-700/30">
                  <div>
                    <span className="text-[10px] opacity-75 uppercase font-bold tracking-wider">
                      PNR Inquiry Status
                    </span>
                    <div className="flex items-center space-x-3 mt-1">
                      <h3 className="text-2xl font-mono font-black">{pnrResult.pnr}</h3>
                      <button
                        onClick={() => copyPnrToClipboard(pnrResult.pnr)}
                        className={`px-3 py-1 rounded-xl border text-xs font-bold flex items-center space-x-1 transition cursor-pointer ${
                          isLight ? "bg-[#76C0EC]/30 border-[#76C0EC] text-[#425B9A]" : "bg-[#1B2CC1]/30 border-[#7692FF] text-[#ABD2FA]"
                        }`}
                      >
                        {copiedPnr === pnrResult.pnr ? (
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
                  </div>
                  <span
                    className={`font-mono font-black text-xs px-3 py-1 rounded-full uppercase ${
                      pnrResult.status === "CONFIRMED"
                        ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40"
                        : pnrResult.status === "HELD"
                        ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                        : "bg-rose-500/20 text-rose-500 border border-rose-500/40"
                    }`}
                  >
                    {pnrResult.status}
                  </span>
                </div>

                {/* DSA Verification Info */}
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    isLight ? "bg-[#FFF6DC] border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                  }`}
                >
                  <div className="font-bold flex items-center space-x-1.5 text-emerald-500">
                    <ShieldCheck className="h-4 w-4" />
                    <span>DSA Pipeline Verification</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] opacity-80 pt-1 font-mono">
                    <div>
                      Bloom Pre-Check: <span className="text-emerald-500 font-bold">PASSED (Positive)</span>
                    </div>
                    <div>
                      Hash Table Lookup: <span className="text-emerald-500 font-bold">O(1) HIT</span>
                    </div>
                  </div>
                </div>

                {/* Passenger Status Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-wider opacity-80">
                    Passenger Statuses:
                  </h4>
                  {pnrResult.passengers?.map((p: any) => (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                        isLight ? "bg-[#FFF6DC]/50 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <div>
                        <div className="font-black text-sm">{p.name}</div>
                        <div className="text-[10px] opacity-75">
                          Age: {p.age} | Quota: {p.quota}
                        </div>
                      </div>
                      <span
                        className={`font-mono font-black px-2.5 py-1 rounded text-xs ${
                          p.status === "CNF"
                            ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/40"
                            : p.status === "WL"
                            ? "bg-amber-500/20 text-amber-500 border border-amber-500/40"
                            : "bg-rose-500/20 text-rose-500 border border-rose-500/40"
                        }`}
                      >
                        {p.status === "CNF"
                          ? `CNF: ${p.coach_code}-${p.berth_number} (${p.berth_type})`
                          : p.status === "WL"
                          ? `WL #${p.wl_number || 1}`
                          : p.status}
                      </span>
                    </div>
                  ))}
                </div>

                {pnrResult.status !== "CANCELLED" && (
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleCancelBooking}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl text-xs font-bold border border-rose-800 text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
                    >
                      Cancel Reservation &amp; Promote Waiting List
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 3: RESERVATION CHART ===================== */}
        {activeTab === "chart" && (
          <div className="space-y-6">
            <div
              className={`rounded-2xl p-6 border shadow-xl transition-all ${
                isLight
                  ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                  : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 text-white shadow-lg shadow-[#091540]"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-dashed border-slate-700/30 gap-3">
                <div>
                  <h3 className="text-base font-black flex items-center space-x-2">
                    <BarChart3 className={`h-5 w-5 ${isLight ? "text-[#425B9A]" : "text-[#7692FF]"}`} />
                    <span>Reservation Chart (Custom Merge-Sort Order)</span>
                  </h3>
                  <p
                    className={`text-xs mt-0.5 ${
                      isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]/80"
                    }`}
                  >
                    Sorted strictly by: 1. Coach Identifier ASC &rarr; 2. Berth Number ASC using academic Merge Sort.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={chartRunId}
                    onChange={(e) => handleLoadChart(parseInt(e.target.value))}
                    className={`text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer ${
                      isLight
                        ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]"
                        : "bg-[#091540] border-[#1B2CC1] text-white"
                    }`}
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
                    className={`p-2 rounded-xl border cursor-pointer ${
                      isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-[#7692FF]"
                    }`}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {chartData && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>
                      Train: {chartData.train_name} ({chartData.train_number}) | Run Date: {chartData.run_date}
                    </span>
                    <span className="font-mono text-[10px] text-emerald-500">
                      Custom Academic Stable Merge Sort (Time: O(N log N), Space: O(N))
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-700/40">
                    <table className="w-full text-left text-xs">
                      <thead
                        className={`font-black uppercase tracking-wider text-[11px] ${
                          isLight ? "bg-[#FFF6DC] text-[#425B9A]" : "bg-[#091540] text-[#ABD2FA]"
                        }`}
                      >
                        <tr>
                          <th className="p-3">Coach</th>
                          <th className="p-3">Berth No</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Passenger Name</th>
                          <th className="p-3">Age / Gender</th>
                          <th className="p-3">Quota</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/20 font-bold">
                        {chartData.chart?.map((row: any, i: number) => (
                          <tr
                            key={i}
                            className={`transition hover:bg-slate-500/10 ${
                              isLight ? "text-[#425B9A]" : "text-slate-200"
                            }`}
                          >
                            <td className="p-3 font-mono font-black">{row.coach_code}</td>
                            <td className="p-3 font-mono font-black">{row.berth_number}</td>
                            <td className="p-3">{row.berth_type}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                  row.status === "AVAILABLE"
                                    ? "bg-emerald-500/20 text-emerald-500"
                                    : row.status === "CONFIRMED"
                                    ? "bg-rose-500/20 text-rose-500"
                                    : "bg-amber-500/20 text-amber-500"
                                }`}
                              >
                                {row.status}
                              </span>
                            </td>
                            <td className="p-3 font-bold">{row.passenger_name || "VACANT"}</td>
                            <td className="p-3">
                              {row.passenger_age ? `${row.passenger_age} / ${row.passenger_gender}` : "-"}
                            </td>
                            <td className="p-3">{row.quota || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: DSA DIAGNOSTICS ===================== */}
        {activeTab === "dsa" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black flex items-center space-x-2">
                  <Database className={`h-5 w-5 ${isLight ? "text-[#425B9A]" : "text-[#7692FF]"}`} />
                  <span>Custom DSA Structural Diagnostics</span>
                </h3>
                <p
                  className={`text-xs mt-0.5 ${
                    isLight ? "text-[#425B9A]/80" : "text-[#ABD2FA]/80"
                  }`}
                >
                  Live metrics proving custom application implementations (Zero DB indexing/sorting).
                </p>
              </div>
              <button
                onClick={loadDSAMetrics}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center space-x-1.5 cursor-pointer ${
                  isLight ? "bg-white border-[#76C0EC] text-[#425B9A]" : "bg-[#0d1c54] border-[#1B2CC1] text-white"
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh Metrics</span>
              </button>
            </div>

            {dsaMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Custom Hash Table */}
                <div
                  className={`rounded-2xl p-6 border shadow-xl space-y-4 transition-all ${
                    isLight
                      ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                      : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 text-white shadow-lg shadow-[#091540]"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-dashed border-slate-700/30 pb-3">
                    <h4 className="text-sm font-black">1. Custom PNR Hash Table (Separate Chaining)</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-[#7692FF] border border-indigo-500/30 font-bold">
                      Polynomial Rolling Hash
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Total Inserted Elements</span>
                      <span className="text-xl font-mono font-black">{dsaMetrics.hash_table.size}</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Bucket Capacity (M)</span>
                      <span className="text-xl font-mono font-black">{dsaMetrics.hash_table.capacity}</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Current Load Factor (&alpha;)</span>
                      <span className="text-xl font-mono font-black text-indigo-400">
                        {dsaMetrics.hash_table.load_factor}
                      </span>
                      <span className="text-[9px] opacity-60 block">Resizes at &ge; 0.75</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Total Collisions Handled</span>
                      <span className="text-xl font-mono font-black text-amber-500">
                        {dsaMetrics.hash_table.collision_count}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] opacity-80 pt-2 border-t border-dashed border-slate-700/30 space-y-1 font-mono">
                    <div>Dynamic Resizes Executed: {dsaMetrics.hash_table.resize_count}</div>
                    <div>
                      Occupied Buckets: {dsaMetrics.hash_table.non_empty_buckets} / {dsaMetrics.hash_table.capacity}
                    </div>
                    <div>Max Chain Length: {dsaMetrics.hash_table.max_chain_length}</div>
                  </div>
                </div>

                {/* 2. Probabilistic Bloom Filter */}
                <div
                  className={`rounded-2xl p-6 border shadow-xl space-y-4 transition-all ${
                    isLight
                      ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                      : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 text-white shadow-lg shadow-[#091540]"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-dashed border-slate-700/30 pb-3">
                    <h4 className="text-sm font-black">2. Probabilistic Bloom Filter Pre-Checker</h4>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-[#7692FF] border border-indigo-500/30 font-bold">
                      Kirsch-Mitzenmacher
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Bit Array Size (m)</span>
                      <span className="text-xl font-mono font-black">{dsaMetrics.bloom_filter.size}</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Hash Functions (k)</span>
                      <span className="text-xl font-mono font-black">{dsaMetrics.bloom_filter.hash_count}</span>
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Bits Currently Set</span>
                      <span className="text-xl font-mono font-black text-emerald-400">
                        {dsaMetrics.bloom_filter.bits_set}
                      </span>
                    </div>
                    <div
                      className={`p-3.5 rounded-xl border ${
                        isLight ? "bg-[#FFF6DC]/60 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]"
                      }`}
                    >
                      <span className="text-[10px] opacity-75 font-bold block">Theoretical False Pos Rate</span>
                      <span className="text-xl font-mono font-black text-indigo-400">
                        {dsaMetrics.bloom_filter.false_positive_rate}
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] opacity-80 pt-2 border-t border-dashed border-slate-700/30 space-y-1">
                    <span className="font-bold text-emerald-400 block">Mathematical Guarantee: Zero False Negatives</span>
                    <span className="text-[10px] font-mono block">
                      Formula: p &approx; (1 - e^(-kn/m))^k. If Bloom Filter returns negative, PNR is guaranteed absent and lookup completes in O(k) time.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 5: ADMIN PORTAL ===================== */}
        {activeTab === "admin" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 5 Cols: Register Train Form */}
              <div className="lg:col-span-5 space-y-4">
                <div
                  className={`rounded-2xl p-6 border shadow-xl transition-all space-y-4 ${
                    isLight
                      ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                      : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 text-white shadow-lg shadow-[#091540]"
                  }`}
                >
                  <div className="flex items-center space-x-2.5 pb-3 border-b border-dashed border-slate-700/30">
                    <Plus className="h-5 w-5 text-[#7692FF]" />
                    <h3 className="text-sm font-black">Register New Train &amp; Schedule</h3>
                  </div>

                  <form onSubmit={handleCreateTrain} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold mb-1 opacity-80">Train Number *</label>
                      <input
                        type="text"
                        placeholder="e.g. 12004"
                        value={adminTrainNumber}
                        onChange={(e) => setAdminTrainNumber(e.target.value)}
                        className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none border transition ${
                          isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-white"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1 opacity-80">Train Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Lucknow Shatabdi"
                        value={adminTrainName}
                        onChange={(e) => setAdminTrainName(e.target.value)}
                        className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none border transition ${
                          isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-white"
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold mb-1 opacity-80">Source Station *</label>
                        <input
                          type="text"
                          placeholder="e.g. Howrah (HWH)"
                          value={adminSource}
                          onChange={(e) => setAdminSource(e.target.value)}
                          className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none border transition ${
                            isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-white"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold mb-1 opacity-80">Destination *</label>
                        <input
                          type="text"
                          placeholder="e.g. New Delhi (NDLS)"
                          value={adminDestination}
                          onChange={(e) => setAdminDestination(e.target.value)}
                          className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none border transition ${
                            isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-white"
                          }`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1 opacity-80">
                        Run Dates (Comma separated YYYY-MM-DD) *
                      </label>
                      <input
                        type="text"
                        value={adminRunDates}
                        onChange={(e) => setAdminRunDates(e.target.value)}
                        className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none border transition ${
                          isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-white"
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1 opacity-80">Coach Layout Preset</label>
                      <select
                        value={adminCoachPreset}
                        onChange={(e) => setAdminCoachPreset(e.target.value)}
                        className={`w-full rounded-xl px-3 py-2 text-xs font-bold outline-none border transition cursor-pointer ${
                          isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-white"
                        }`}
                      >
                        <option value="standard">Standard Fleet (A1 2AC, B1 3AC, S1 Sleeper = 36 Berths)</option>
                        <option value="mini">Compact Test (A1 2AC = 8 Berths)</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={adminCreating}
                      className={`w-full py-2.5 rounded-xl font-bold transition text-xs flex items-center justify-center space-x-1.5 cursor-pointer shadow-md ${
                        isLight
                          ? "bg-[#425B9A] text-white hover:bg-[#334677]"
                          : "bg-[#1B2CC1] text-white hover:bg-[#1523a0] border border-[#7692FF]/50"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                      <span>{adminCreating ? "Creating Train..." : "Save & Register Train"}</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right 7 Cols: Active Fleet Management Table */}
              <div className="lg:col-span-7 space-y-4">
                <div
                  className={`rounded-2xl p-6 border shadow-xl transition-all space-y-3 ${
                    isLight
                      ? "bg-white border-[#76C0EC]/50 text-[#425B9A]"
                      : "bg-[#0d1c54]/80 border-[#1B2CC1]/50 text-white shadow-lg shadow-[#091540]"
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-700/30">
                    <h3 className="text-sm font-black">Live Fleet Management ({trains.length} Trains)</h3>
                    <button
                      onClick={loadTrains}
                      className={`p-1.5 rounded-lg border cursor-pointer ${
                        isLight ? "bg-[#FFF6DC] border-[#76C0EC] text-[#425B9A]" : "bg-[#091540] border-[#1B2CC1] text-[#7692FF]"
                      }`}
                    >
                      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {trains.map((t) => (
                      <div
                        key={t.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                          isLight ? "bg-[#FFF6DC]/50 border-[#76C0EC]/40" : "bg-[#091540] border-[#1B2CC1]/60"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                                isLight ? "bg-[#425B9A] text-white" : "bg-[#1B2CC1] text-[#ABD2FA]"
                              }`}
                            >
                              {t.train_number}
                            </span>
                            <span className="text-xs font-black">{t.train_name}</span>
                          </div>
                          <div className="text-[10px] opacity-75">
                            {t.source_station} &rarr; {t.destination_station} &bull; {t.runs?.length || 0} Runs Scheduled
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteTrain(t.id, t.train_number, t.train_name)}
                          disabled={adminDeletingId === t.id}
                          className="px-2.5 py-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-950/40 transition text-xs flex items-center space-x-1 cursor-pointer border border-rose-900/50"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Notifications Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl flex items-start space-x-3 transition-all transform animate-in slide-in-from-bottom-2 ${
              toast.type === "success"
                ? "bg-emerald-950/95 border-emerald-700 text-emerald-100"
                : toast.type === "error"
                ? "bg-rose-950/95 border-rose-700 text-rose-100"
                : toast.type === "warning"
                ? "bg-amber-950/95 border-amber-700 text-amber-100"
                : "bg-slate-900/95 border-[#1B2CC1] text-slate-100"
            }`}
          >
            {toast.type === "success" && <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === "error" && <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === "warning" && <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === "info" && <Info className="h-5 w-5 text-[#7692FF] shrink-0 mt-0.5" />}
            <div className="flex-1">
              <h5 className="text-xs font-bold">{toast.title}</h5>
              <p className="text-[11px] opacity-80 mt-0.5">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
