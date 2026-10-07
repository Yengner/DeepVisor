import { NextRequest, NextResponse } from "next/server";
import {
  loadExploration,
  ExplorationNotFound,
} from "@/lib/server/campaigns/exploration/load";
import { loadOverviewContext } from "@/lib/server/dashboard/overview/load";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const level = params.get("level"),
    period = params.get("period") ?? "7d";
  if (
    !["campaign", "adset", "ad"].includes(level ?? "") ||
    !["today", "7d", "30d"].includes(period)
  )
    return NextResponse.json(
      { error: "Choose a valid view and period." },
      { status: 400 },
    );
  try {
    const context = await loadOverviewContext();
    // Reject stale tabs after account switches, even when the entity ID exists elsewhere.
    const account = params.get("account");
    if (
      !context.account ||
      !account ||
      ![context.account.id, context.account.external_account_id].includes(
        account,
      )
    )
      return NextResponse.json(
        { error: "The selected account changed. Reload this page." },
        { status: 409 },
      );
    const data = await loadExploration(
      period as "today" | "7d" | "30d",
      level as "campaign" | "adset" | "ad",
      params.get("parent"),
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Advertising exploration failed", error);
    return NextResponse.json(
      { error: "Advertising details could not be loaded. Please try again." },
      { status: error instanceof ExplorationNotFound ? 404 : 500 },
    );
  }
}
