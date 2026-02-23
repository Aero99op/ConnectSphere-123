"use client";

export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { DepartmentDashboard } from "@/components/dashboard/department-dashboard";
import { Loader2 } from "lucide-react";

export default function OfficialsDashboardPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>}>
            <DepartmentDashboard />
        </Suspense>
    );
}
