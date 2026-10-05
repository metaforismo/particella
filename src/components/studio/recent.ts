"use client";

import type { Plot } from "@/lib/contracts";
import { createPlotList, plotRef } from "@/lib/plot-list";

const recent = createPlotList("particella:recent-plots", 6);

export const rememberPlot = (plot: Plot) => recent.add(plotRef(plot));
export const forgetRecentPlots = () => recent.clear();
export const useRecentPlots = () => recent.useList();
