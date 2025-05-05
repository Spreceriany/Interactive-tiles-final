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
import { Label } from "@/components/ui/label";

export default function SignalVisualizer() {
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [wastedEnergyData, setWastedEnergyData] = useState<
    { signal: string; wastedEnergy: number }[]
  >([]);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Define colors for each signal for consistency
  const colorMap = {
    "Signal A": "#FF6384",
    "Signal B": "#36A2EB",
    "Signal C": "#FFCE56",
    "Signal D": "#4BC0C0",
    "Signal E": "#9966FF",
    "Signal F": "#FF9F40",
    "Signal G": "#2ECC71",
    "Signal H": "#E74C3C",
    "Signal I": "#3498DB",
    "Signal J": "#F39C12",
    "Signal K": "#9B59B6",
    "Signal L": "#1ABC9C",
    "Signal M": "#E67E22",
    "Signal N": "#34495E",
    "Signal O": "#7F8C8D",
    "Signal P": "#D35400",
    "Signal Q": "#27AE60",
    "Signal R": "#2980B9",
    "Signal S": "#8E44AD",
    "Energy Lost": "#C0392B",
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:3000/data");
        const csvData = await res.text();
        // Get the CSV data using the window.fs API
        //const csvData: string = await window.fs.readFile('data.csv', { encoding: 'utf8' });

        // Parse CSV with PapaParse
        Papa.parse(csvData, {
          header: true,
          delimiter: ";", // Use semicolon as delimiter
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(), // Trim whitespace from headers
          complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
            if (results.data && results.data.length > 0) {
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
              const signalColumns = Object.keys(processedData[0]).filter(
                (key) => key.includes("Signal") || key === "Energy Lost"
              );

              // Initialize with a few signals to avoid overwhelming the chart
              const initialSelectedSignals = [
                "Signal C",
                "Signal D",
                "Signal G",
                "Energy Lost",
              ];

              setData(processedData);
              setWastedEnergyData(wastedEnergyBySignal);
              setSelectedSignals(initialSelectedSignals);
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

  return (
    <div className="w-full space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Wasted Energy by Signal</CardTitle>
          <CardDescription>
            Total wasted energy for each signal across all time steps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={wastedEnergyData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="signal"
                  label={{
                    value: "Signal",
                    position: "insideBottomRight",
                    offset: -5,
                  }}
                />
                <YAxis
                  label={{
                    value: "Wasted Energy",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  formatter={(value) => [`${value}`, "Wasted Energy"]}
                  labelFormatter={(label) => `Signal ${label}`}
                />
                <Legend />
                <Bar
                  dataKey="wastedEnergy"
                  name="Wasted Energy"
                  fill="#8884d8"
                  animationDuration={1500}
                  label={{
                    position: "top",
                    formatter: (value: any) => (value > 5 ? value : ""),
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signal Values Over Time</CardTitle>
          <CardDescription>
            Time series visualization of selected signals
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
                <XAxis
                  dataKey="Discrete Time"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                {selectedSignals.map((signal) => (
                  <Line
                    key={signal}
                    type="monotone"
                    dataKey={signal}
                    stroke={
                      colorMap[signal as keyof typeof colorMap] || "#000000"
                    }
                    dot={{ r: 1 }}
                    activeDot={{ r: 5 }}
                    strokeWidth={2}
                    name={signal}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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
