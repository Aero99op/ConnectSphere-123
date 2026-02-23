"use client";

import { LayoutDashboard, Map as MapIcon, History, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export type DeptTab = "dashboard" | "heatmap" | "history" | "profile";

interface DepartmentNavProps {
    activeTab: DeptTab;
    onTabChange: (tab: DeptTab) => void;
}

export function DepartmentNav({ activeTab, onTabChange }: DepartmentNavProps) {
    const navItems = [
        { id: "dashboard", icon: LayoutDashboard, label: "Cmd Center" },
        { id: "heatmap", icon: MapIcon, label: "Radar" },
        { id: "history", icon: History, label: "Intel Logs" },
        { id: "profile", icon: User, label: "Operator" },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[120] pointer-events-none safe-area-bottom md:bottom-8 flex justify-center">
            {/* The Floating Dock */}
            <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="pointer-events-auto flex items-center justify-between gap-2 p-2 mx-4 md:mx-0 bg-[#060a1f]/80 backdrop-blur-2xl border border-cyan-500/20 shadow-[0_0_40px_rgba(6,182,212,0.15)] rounded-full w-full max-w-[420px]"
            >
                {navItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id as DeptTab)}
                            className="relative flex-1 flex flex-col items-center justify-center py-2 md:py-3 group outline-none isolate"
                        >
                            {/* Active Indicator Background (Pill) */}
                            {isActive && (
                                <motion.div
                                    layoutId="navPill"
                                    className="absolute inset-0 bg-cyan-500/10 border border-cyan-400/30 rounded-full z-0 pointer-events-none"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}

                            {/* Icon Container */}
                            <motion.div
                                className="relative z-10 p-1.5"
                                whileHover={{ scale: 1.15 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 transition-colors duration-300",
                                        isActive ? "text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "text-slate-500 group-hover:text-cyan-200"
                                    )}
                                    strokeWidth={isActive ? 2.5 : 2}
                                />
                            </motion.div>

                            {/* Label */}
                            <span className={cn(
                                "relative z-10 text-[9px] font-black uppercase tracking-widest mt-1 transition-all duration-300",
                                isActive ? "text-cyan-300" : "text-slate-600 group-hover:text-cyan-100"
                            )}>
                                {item.label}
                            </span>
                        </button>
                    )
                })}
            </motion.div>
        </div>
    );
}
