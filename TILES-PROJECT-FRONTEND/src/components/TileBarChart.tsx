import { useState, useEffect } from "react";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
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

export function TileBarChart() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [wastedEnergyData, setWastedEnergyData] = useState<
    { signal: string; wastedEnergy: number }[]
  >([]);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartConfig = {
    desktop: {
      label: "Desktop",
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  // Define colors for each signal for consistency

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/data");
        const csvData = await res.text();

        // Parse CSV with PapaParse
        Papa.parse(csvData, {
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

              console.log("Processed data:", results.data[62]);

              // Find and process the wasted energy data (at index 60 and 62)
              // The row at index 60 contains signal names (A, B, C...)
              // The row at index 62 contains the corresponding wasted energy values
              let wastedEnergyBySignal: {
                signal: string;
                wastedEnergy: number;
              }[] = [];

              // Get all raw data rows (including those without headers)
              const allRows = csvData.split("\n");

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
              const initialSelectedSignals = [
                "Signal C",
                "Signal D",
                "Signal G",
                "Energy Lost",
              ];

              setData(processedData);
              setSelectedSignals(initialSelectedSignals);
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

    fetchData();
  }, []);

  if (loading) return <div>Loading data...</div>;
  if (error) return <div>Error: {error}</div>;

  // Find max value index
  const getMaxValueIndex = () => {
    if (!wastedEnergyData || wastedEnergyData.length === 0) return -1;
    let maxValue = -Infinity;
    let maxIndex = -1;

    wastedEnergyData.forEach((item, index) => {
      if (item.wastedEnergy > maxValue) {
        maxValue = item.wastedEnergy;
        maxIndex = index;
      }
    });

    return maxIndex;
  };

  const maxValueIndex = getMaxValueIndex();

  return (
    <div className="w-full space-y-4">
      <Card className="bg-backround  text-center">
        <CardHeader>
          <CardTitle>Wasted Energy by Signal</CardTitle>
          <CardDescription>
            Total wasted energy for each signal across all time steps
          </CardDescription>
        </CardHeader>
      </Card>
      <ChartContainer
        config={chartConfig}
        className="min-h-[200px] w-full max-h-[400px]"
      >
        <BarChart
          data={wastedEnergyData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
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
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
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

      {selectedSignals.includes("Energy Lost") && (
        <Card>
          <CardHeader>
            <CardTitle>Energy Lost Over Time</CardTitle>
            <CardDescription>
              Cumulative energy lost at each time step
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Discrete Time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Energy Lost"
                    stroke="#C0392B"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
