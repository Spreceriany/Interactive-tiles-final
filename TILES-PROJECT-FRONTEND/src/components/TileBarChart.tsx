import { useState, useEffect } from "react";
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

  // Define colors for each signal for consistency

  const fetchData = async () => {
    try {
      const { data } = await supabase.storage
        .from("csv-bucket")
        .getPublicUrl("data.csv");

      console.log(data.publicUrl);

      // Parse CSV with PapaParse
      Papa.parse(`${data.publicUrl}?t=${Date.now()}`, {
        download: true,
        header: true,
        delimiter: ";", // Use semicolon as delimiter
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(), // Trim whitespace from headers
        complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
          if (results.data && results.data.length > 0) {
            const rawRow = results.data[62]; // Already parsed to an object
            const signals = Object.entries(rawRow)
              .filter(([key]) => key.startsWith("Signal ")) // Get only signal keys
              .filter(([key]) => {
                const letter = key.replace("Signal ", "");
                return /^[A-S]$/.test(letter); // Only keep Signal A to Signal S
              })
              .map(([key, value]) => ({
                signal: key.replace("Signal ", ""), // Use just the letter for X-axis
                wastedEnergy:
                  parseFloat(
                    typeof value === "string" ? value.replace(",", ".") : "0"
                  ) || 0,
              }));

            // Process the time series data
            const processedData = results.data
              .filter(
                (row) =>
                  row["Discrete Time"] !== undefined &&
                  row["Discrete Time"] !== ""
              )
              .map((row) => {
                const newRow: Record<string, any> = {};
                // Convert comma decimals to periods for all numeric fields
                Object.keys(row).forEach((key) => {
                  if (row[key] && typeof row[key] === "string") {
                    // Skip empty cells and convert comma decimals to periods
                    const value = row[key].replace(",", ".").trim();
                    newRow[key] =
                      value === ""
                        ? 0
                        : isNaN(Number(value))
                        ? value
                        : Number(value);
                  } else {
                    newRow[key] = row[key];
                  }
                });
                return newRow;
              });

            // Find and process the wasted energy data (at index 60 and 62)
            // The row at index 60 contains signal names (A, B, C...)
            // The row at index 62 contains the corresponding wasted energy values
            let wastedEnergyBySignal: {
              signal: string;
              wastedEnergy: number;
            }[] = [];

            // Get all raw data rows (including those without headers)
            const allRows = data.publicUrl.split("\n");

            if (allRows.length >= 62) {
              try {
                // Parse the row with signal letters (row 60)
                const signalLettersRow = allRows[60].split(";");
                // Parse the row with wasted energy values (row 62)
                const wastedEnergyRow = allRows[62].split(";");

                // Map the letters to their corresponding values
                // Start from index 1 to skip the first column which contains the header
                for (let i = 1; i < signalLettersRow.length - 2; i++) {
                  const signalLetter = signalLettersRow[i].trim();
                  if (signalLetter && wastedEnergyRow[i]) {
                    // Convert comma decimal to period
                    const wastedEnergy =
                      parseFloat(wastedEnergyRow[i].replace(",", ".")) || 0;

                    if (!isNaN(wastedEnergy)) {
                      wastedEnergyBySignal.push({
                        signal: signalLetter,
                        wastedEnergy: wastedEnergy,
                      });
                    }
                  }
                }
              } catch (err) {
                console.error("Error parsing wasted energy rows:", err);
              }
            }

            // Extract all signal column names for the time series data

            // Initialize with a few signals to avoid overwhelming the chart

            setData(processedData);
            setWastedEnergyData(signals);
            setWastedEnergyData(signals);

            setLoading(false);
          }
        },
        error: (error: any) => {
          console.error("Error parsing CSV:", error);
          setError("Failed to parse CSV data");
          setLoading(false);
        },
      });
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Failed to load data");
      setLoading(false);
    }
  };

  useEffect(() => {
    const socket = new WebSocket("wss://interactive-tiles-final.onrender.com");

    socket.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    socket.onmessage = (event) => {
      if (event.data === "csv_updated") {
        console.log("🔁 CSV updated, refetching...");
        fetchData();
      }
    };
    socket.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };

    socket.onclose = () => {
      console.log("🔌 WebSocket disconnected");
    };

    fetchData();
  }, []);

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
                    animationDuration={1200}
                    label={{
                      position: "top",
                      formatter: (value: any) => (value > 5 ? value : ""),
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
