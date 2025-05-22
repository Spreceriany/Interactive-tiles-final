import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

import { createClient } from "@supabase/supabase-js";

export function TileBarChart() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [wastedEnergyData, setWastedEnergyData] = useState<
    { signal: string; wastedEnergy: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [view, setView] = useState("bar");

  const isMounted = useRef(false);
  const fetchingLock = useRef(false); // To prevent concurrent fetches

  const supabase = createClient(
    "https://wfrzbyvbralxrdpvtnsp.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmcnpieXZicmFseHJkcHZ0bnNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzczMDA4OCwiZXhwIjoyMDYzMzA2MDg4fQ.PW-P__mSJ1R8hvGPblFveWYQsMi2rN5BnTGo3HLleqQ"
  );

  const chartConfig = {
    desktop: {
      label: "Desktop",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Define colors for each signal for consistency

  const fetchData = async () => {
    // `isChartAnimating` is set to `false` by the caller (socket.onmessage or initial load)
    // `WorkspaceingLock` is acquired by the caller

    console.log("fetchData: Called");
    try {
      const { data: publicUrlData } = await supabase.storage
        .from("csv-bucket")
        .getPublicUrl("data.csv");

      if (!publicUrlData) throw new Error("No public URL returned for CSV.");

      // Cache-busting for PapaParse download
      const urlWithCacheBuster = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      console.log("fetchData: Fetching from URL:", urlWithCacheBuster);

      Papa.parse(urlWithCacheBuster, {
        download: true,
        header: true,
        delimiter: ";",
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        dynamicTyping: false, // Important: handle type conversion manually and consistently
        complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
          console.log("fetchData: Papa.parse complete");
          if (!isMounted.current) {
            console.log(
              "fetchData: Component unmounted, aborting Papa.parse complete callback."
            );
            fetchingLock.current = false; // Release lock if component unmounted during parse
            return;
          }

          if (results.errors.length > 0) {
            console.error("fetchData: Papa.parse errors:", results.errors);
            setError(`Failed to parse CSV: ${results.errors[0].message}`);
            setLoading(false);
            fetchingLock.current = false; // Release lock
            return;
          }

          if (results.data && results.data.length > 0) {
            // Ensure you are targeting the correct row for signals, checking length
            const signalRowIndex = 62; // Adjust if needed, ensure it's 0-indexed
            if (results.data.length <= signalRowIndex) {
              setError(
                `CSV data does not have enough rows for signal data (index ${signalRowIndex}). Found ${results.data.length} rows.`
              );
              setLoading(false);
              fetchingLock.current = false;
              return;
            }
            const rawRow = results.data[signalRowIndex];

            const newSignals = Object.entries(rawRow)
              .filter(([key]) => key.startsWith("Signal "))
              .filter(([key]) => /^[A-S]$/.test(key.replace("Signal ", "")))
              .map(([key, value]) => ({
                signal: key.replace("Signal ", ""),
                wastedEnergy: parseFloat(String(value).replace(",", ".")) || 0,
              }));

            // Process the time series data (for AreaChart)
            const processedData = results.data
              .filter(
                (row) =>
                  row["Discrete Time"] !== undefined &&
                  String(row["Discrete Time"]).trim() !== ""
              )
              .map((row) => {
                const newRow: Record<string, any> = {
                  "Discrete Time": String(row["Discrete Time"]).trim(),
                }; // Ensure Discrete Time is a string if it's the category
                Object.keys(row).forEach((key) => {
                  if (key === "Discrete Time") return; // Already handled
                  const cellValue = row[key];
                  if (
                    cellValue === null ||
                    cellValue === undefined ||
                    String(cellValue).trim() === ""
                  ) {
                    newRow[key] = 0; // Default for empty or missing numerics
                  } else if (typeof cellValue === "string") {
                    const val = String(cellValue).replace(",", ".").trim();
                    newRow[key] = isNaN(Number(val)) ? val : Number(val);
                  } else {
                    newRow[key] = cellValue; // Assume it's already a number if not string
                  }
                });
                return newRow;
              });

            console.log(
              "fetchData: Setting new data. isChartAnimating should be false here."
            );
            setData(processedData);
            setWastedEnergyData(newSignals); // This is the key data for the BarChart
            setLoading(false);

            // Mimic the manual button's animation trigger
            setTimeout(() => {
              if (isMounted.current) {
                console.log(
                  "fetchData: setTimeout callback - Setting isChartAnimating to true."
                );
              }
            }, 50); // 50ms delay
          } else {
            setError("No data found in parsed CSV.");
            setLoading(false);
          }
          fetchingLock.current = false; // Release lock
        },
        error: (error: any) => {
          if (isMounted.current) {
            console.error("fetchData: Papa.parse stream error:", error);
            setError(`Failed to parse CSV stream: ${error.message}`);
            setLoading(false);
          }
          fetchingLock.current = false; // Release lock
        },
      });
    } catch (error: any) {
      if (isMounted.current) {
        console.error("fetchData: Error fetching or processing CSV:", error);
        setError(`Failed to load data: ${error.message}`);
        setLoading(false);
        // Ensure animation is off on error if it was turned off before fetch
        // setIsChartAnimating(false);
      }
      fetchingLock.current = false; // Release lock
    }
  };

  useEffect(() => {
    const socket = new WebSocket("wss://interactive-tiles-final.onrender.com");

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    socket.onmessage = (event) => {
      if (event.data === "csv_updated") {
        if (!isMounted.current) return;

        if (fetchingLock.current) {
          console.log("WebSocket: Already fetching, update skipped.");
          return;
        }
        fetchingLock.current = true; // Acquire lock

        console.log(
          "WebSocket: CSV updated, refetching... Setting isChartAnimating to false."
        );
        fetchData(); // Step 2 & 3 happen inside fetchData's callbacks
      }
    };
    socket.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };

    socket.onclose = () => {
      console.log("🔌 WebSocket disconnected");
    };
    if (isMounted.current) {
      if (fetchingLock.current) return; // Should not happen on initial mount
      fetchingLock.current = true;
      console.log("Initial load: Setting isChartAnimating to false.");
      fetchData();
    }

    fetchData();
  }, []);

  // Inside your TileBarChart component

  // Add this function
  // const handleManualUpdate = () => {
  //   console.log("Manual update triggered");

  //   // Create some new data based on the old data
  //   const manualNewData = wastedEnergyData.map((bar, index) => ({
  //     ...bar,
  //     // Ensure values actually change significantly for a visible animation
  //     wastedEnergy: Math.max(
  //       0,
  //       bar.wastedEnergy + (index % 2 === 0 ? 10 : -10) * Math.random() * 5 + 5
  //     ),
  //   }));

  //   setWastedEnergyData(manualNewData); // Step 2: Set new data (while animation is still "off" for this render pass)
  //   // setLoading(false); // if your loading state is involved

  //   // Step 3: Turn animation ON in the next tick
  //   setTimeout(() => {
  //     console.log("Setting isChartAnimating to true for manual update");
  //   }, 50); // A small delay (e.g., 50ms)
  // };

  // In your JSX, add this button somewhere visible:

  const toggleChart = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setView(view === "bar" ? "list" : "bar");
      setTimeout(() => {
        setIsAnimating(false);
      }, 100); // Duration of fade-in animation
    }, 100); // Duration of fade-out animation
  };

  if (loading) return <div>Loading data...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="w-full min-h-[90vh] items-center flex  flex-col  justify-center px-4">
      <div className="flex justify-center mb-6 ">
        <div
          className="text-primary"
          style={{
            color: "var(--color-desktop)",
            display: "flex",
            borderRadius: "100px",
            backgroundColor: "#0036FF80",
            position: "relative",
            width: "300px",
            height: "32px",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "50%",
              height: "100%",
              backgroundColor: "#040631",
              borderRadius: "40px",
              transition: "transform 0.3s ease",
              color: "var(--primary)",

              transform: view === "bar" ? "translateX(0)" : "translateX(100%)",
            }}
          />
          <button
            disabled={isAnimating}
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1,
              cursor: "pointer",
              color: "var(--primary)",
            }}
            onClick={toggleChart}
          >
            Wasted energy
          </button>
          <button
            disabled={isAnimating}
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1,
              cursor: "pointer",
              height: "100%",
              color: "var(--primary)",
            }}
            onClick={toggleChart}
          >
            Energy Lost
          </button>
        </div>
      </div>
      <div
        className={`transition-opacity duration-300 w-full  ${
          isAnimating ? "opacity-0" : "opacity-100"
        }`}
      >
        {view === "bar" ? (
          <div className="w-full">
            <Card className="bg-backround  text-center">
              <CardHeader>
                <CardTitle>Wasted Energy by Signal</CardTitle>
                <CardDescription>
                  Total wasted energy for each signal across all time steps
                </CardDescription>
              </CardHeader>
              <ChartContainer
                config={chartConfig}
                className=" w-full max-h-[400px]"
              >
                <BarChart data={wastedEnergyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="signal"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis
                    label={{
                      value: "Wasted Energy per Tile",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent hideIndicator={true} />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <defs>
                    <linearGradient
                      id="barGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="rgba(0, 212, 255, 1)" />
                      <stop offset="65%" stopColor="rgba(9, 9, 121, 1)" />
                      <stop offset="100%" stopColor="rgba(2, 0, 36, 1)" />
                    </linearGradient>
                  </defs>
                  <Bar
                    fill="url(#barGradient)"
                    radius={8}
                    dataKey="wastedEnergy"
                    name="Wasted Energy"
                    label={{
                      position: "top",
                    }}
                  />
                </BarChart>
              </ChartContainer>
            </Card>
          </div>
        ) : (
          <Card className="bg-backround  text-center ">
            <CardHeader>
              <CardTitle>Energy Lost Over Time</CardTitle>
              <CardDescription>
                Cumulative energy lost at each time step
              </CardDescription>
            </CardHeader>

            <ChartContainer config={chartConfig} className="max-h-[400px]">
              <AreaChart
                accessibilityLayer
                data={data}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="Discrete Time" name="Time" axisLine={false} />
                <YAxis />

                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <defs>
                  <linearGradient
                    id="customGradient"
                    x1="0"
                    y1="1"
                    x2="0"
                    y2="0"
                  >
                    <stop offset="0%" stopColor="rgba(2, 0, 36, 1)" />
                    <stop offset="35%" stopColor="rgba(9, 9, 121, 1)" />
                    <stop offset="100%" stopColor="rgba(0, 212, 255, 1)" />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="Energy Lost"
                  type="natural"
                  fill="url(#customGradient)"
                  fillOpacity={0.4}
                  stroke="var(--color-desktop)"
                  stackId="a"
                />
              </AreaChart>
            </ChartContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
