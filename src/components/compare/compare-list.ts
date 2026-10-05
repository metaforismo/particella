"use client";

import { COMPARE_LIMIT } from "@/lib/compare";
import { createPlotList } from "@/lib/plot-list";

export const compareList = createPlotList("particella:compare", COMPARE_LIMIT);
